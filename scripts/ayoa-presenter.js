// ayoa-presenter.js — Operações adaptativas do painel Apresentador
//
// Uso:
//   node ayoa-presenter.js --mode open                     (abre painel e lista slides)
//   node ayoa-presenter.js --mode list                     (só lista slides)
//   node ayoa-presenter.js --mode nav --from 1 --to 10    (navega slides 1..10)
//   node ayoa-presenter.js --mode prepare                  (prepara deck com auto-create)
//   node ayoa-presenter.js --mode present --action ...    (start|next|previous|stop)
//   node ayoa-presenter.js --mode run [--expected-count N] (driver completo com máquina de estados)

const puppeteer = require('puppeteer-core');
const fs = require('fs');

const PREFIX = process.env.PREFIX || '/data/data/com.termux/files/usr';
const CHROME_PATH = `${PREFIX}/lib/chromium/headless_shell`;

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i].startsWith('--')) {
      const key = process.argv[i].slice(2);
      const val = process.argv[i + 1];
      if (val && !val.startsWith('--')) { args[key] = val; i++; }
      else { args[key] = true; }
    }
  }
  return args;
}

const ARGS = parseArgs();
const COOKIES_FILE = ARGS.cookies;
const TARGET = ARGS.target;
const MODE = ARGS.mode || 'open';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.error(`[${new Date().toISOString().slice(11,23)}]`, ...a);
const pageStateCache = new WeakMap();

async function getSlideList(page) {
  const slides = await page.evaluate(() => {
    const items = document.querySelectorAll('.slides-list-group-item');
    return Array.from(items).map(el => ({
      id: el.id,
      number: (el.querySelector('.slides-list-group-counter')?.innerText || '').trim(),
      title: (el.querySelector('.slides-list-group-content')?.innerText || '').trim(),
      selected: el.classList.contains('selected'),
    }));
  });
  if (slides.length) {
    const cached = pageStateCache.get(page) || {};
    pageStateCache.set(page, { ...cached, slides });
  }
  return slides;
}

async function openPresenter(page, { timeout = 40000 } = {}) {
  // Idempotent: reusing an already-open panel avoids accidentally closing it.
  const existingPanel = await page.$('.slides-list-container');
  if (existingPanel) {
    const slides = await getSlideList(page);
    log(`Presenter already open, ${slides.length} slides found`);
    return slides;
  }

  // The Ayoa SPA can mount the toolbar 10–30 seconds after navigation on Termux.
  // Poll for readiness and click at most once per mount attempt; repeated blind
  // clicks can toggle an already-open Presenter closed.
  const deadline = Date.now() + timeout;
  let clickedAt = 0;
  while (Date.now() < deadline) {
    const panel = await page.$('.slides-list-container');
    if (panel) {
      const slides = await getSlideList(page);
      log(`Presenter opened, ${slides.length} slides found`);
      return slides;
    }

    const btn = await page.$('.toggle-presenter');
    if (btn && (!clickedAt || Date.now() - clickedAt > 8000)) {
      await btn.click();
      clickedAt = Date.now();
    }
    await sleep(500);
  }

  throw new Error(`Presenter did not become ready within ${timeout}ms. Verify the mind map finished loading and the account includes Present mode.`);
}

async function navigateToSlide(page, slideId) {
  return await page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) return false;
    el.scrollIntoView({ block: 'nearest' });
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  }, slideId);
}

async function clickPlayButton(page) {
  const playBtn = await page.$('.slides-play-stop-button');
  if (!playBtn) return false;
  
  await page.evaluate(() => {
    const btn = document.querySelector('.slides-play-stop-button');
    if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  return true;
}

async function waitFor(page, predicate, { timeout = 5000, interval = 100, message = 'condition' } = {}, argument) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await page.evaluate(predicate, argument)) return true;
    await sleep(interval);
  }
  throw new Error(`Timed out waiting for ${message}`);
}

async function getPresentationState(page) {
  const domState = await page.evaluate(() => {
    const panel = document.querySelector('.slides-list-container');
    const play = document.querySelector('.slides-play-stop-button');
    const selected = document.querySelector('.slides-list-group-item.selected');
    const slides = Array.from(document.querySelectorAll('.slides-list-group-item'));
    return {
      panelOpen: Boolean(panel),
      slideCount: slides.length,
      presenting: Boolean(panel?.classList.contains('presenting') || play?.classList.contains('selected')),
      compact: Boolean(panel?.classList.contains('compact') || document.querySelector('.slides-compact-button.selected')),
      fullscreen: Boolean(
        document.fullscreenElement ||
        document.querySelector('#app-content.presenter-fullscreen') ||
        document.querySelector('.slides-fullscreen-button.selected')
      ),
      activeId: selected?.id || null,
      activeIndex: selected ? slides.indexOf(selected) : -1,
      activeTitle: (selected?.querySelector('.slides-list-group-content')?.innerText || '').trim(),
      hasPreviousControl: Boolean(document.querySelector('.slides-nav-container > :first-child')),
      hasNextControl: Boolean(document.querySelector('.slides-nav-container > :last-child')),
      dualScreenAvailable: Boolean(document.querySelector('.slides-popout-button')),
      boundaryMarker: Boolean(document.querySelector('.slides-list-group-item.selected .blue-square, .slides-list-group-item.selected [class*="boundary"]')),
    };
  });

  const cached = pageStateCache.get(page) || {};
  const domSlides = domState.slideCount ? await getSlideList(page) : [];
  const slides = domSlides.length ? domSlides : (cached.slides || []);
  let activeIndex = domState.activeIndex;
  let activeId = domState.activeId;
  let activeTitle = domState.activeTitle;

  if (domState.slideCount) {
    if (activeIndex >= 0) {
      pageStateCache.set(page, { ...cached, slides, activeIndex, activeId, activeTitle });
    } else {
      pageStateCache.set(page, { ...cached, slides });
    }
  } else if (domState.compact && slides.length) {
    activeIndex = Number.isInteger(cached.activeIndex) ? cached.activeIndex : 0;
    activeId = cached.activeId || slides[activeIndex]?.id || null;
    activeTitle = cached.activeTitle || slides[activeIndex]?.title || '';
  }

  return { ...domState, slideCount: slides.length || domState.slideCount, activeIndex, activeId, activeTitle, slides };
}

async function preparePresentation(page, { autoCreate = true } = {}) {
  let slides = await openPresenter(page);
  if (!slides.length && autoCreate) {
    const created = await autoCreatePresentation(page);
    if (!created) throw new Error('Presentation is empty and Auto-create was not available');
    await waitFor(page, () => document.querySelectorAll('.slides-list-group-item').length > 0, {
      timeout: 8000,
      message: 'Ayoa Auto-create to populate the presentation',
    });
    slides = await getSlideList(page);
  }
  if (!slides.length) throw new Error('Presentation has no slides');
  let state = await getPresentationState(page);
  if (state.presenting) {
    state = await stopPresentation(page);
  }
  return { ...state, slides };
}

async function startPresentation(page, { startAt = 1 } = {}) {
  const prepared = await preparePresentation(page, { autoCreate: true });
  if (startAt < 1 || startAt > prepared.slides.length) {
    throw new RangeError(`startAt must be between 1 and ${prepared.slides.length}`);
  }
  if (prepared.presenting) await stopPresentation(page);
  const ok = await navigateToSlide(page, prepared.slides[startAt - 1].id);
  if (!ok) throw new Error(`Unable to select start slide ${startAt}`);
  await waitFor(page, (expectedId) => document.querySelector('.slides-list-group-item.selected')?.id === expectedId,
    { message: `start slide ${startAt} selection` }, prepared.slides[startAt - 1].id);
  const clicked = await clickPlayButton(page);
  if (!clicked) throw new Error('Start presenting control not found');
  await waitFor(page, () => {
    const panel = document.querySelector('.slides-list-container');
    const play = document.querySelector('.slides-play-stop-button');
    return Boolean(panel?.classList.contains('presenting') || play?.classList.contains('selected'));
  }, { message: 'Present mode to start' });
  // Ayoa activates the first slide asynchronously ~200ms after Start, even if
  // another slide was selected during preparation. Wait for that initialization,
  // then enforce the caller's requested startAt deterministically.
  await sleep(300);
  const requestedId = prepared.slides[startAt - 1].id;
  const activeAfterStart = (await getPresentationState(page)).activeId;
  if (activeAfterStart !== requestedId) {
    const selected = await navigateToSlide(page, requestedId);
    if (!selected) throw new Error(`Unable to restore start slide ${startAt} after Present mode initialized`);
    await waitFor(page, (expectedId) => document.querySelector('.slides-list-group-item.selected')?.id === expectedId,
      { message: `Present mode start slide ${startAt}` }, requestedId);
  }
  await sleep(700);
  return getPresentationState(page);
}

async function stopPresentation(page) {
  const state = await getPresentationState(page);
  if (!state.presenting) return state;
  const clicked = await clickPlayButton(page);
  if (!clicked) throw new Error('Stop presenting control not found');
  await waitFor(page, () => {
    const panel = document.querySelector('.slides-list-container');
    const play = document.querySelector('.slides-play-stop-button');
    return !panel?.classList.contains('presenting') && !play?.classList.contains('selected');
  }, { message: 'Present mode to stop' });
  return getPresentationState(page);
}

async function navigatePresentation(page, direction) {
  const selectors = {
    previous: '.slides-nav-container > :first-child',
    next: '.slides-nav-container > :last-child',
  };
  if (!Object.prototype.hasOwnProperty.call(selectors, direction)) {
    throw new Error(`Invalid presentation direction: ${direction}. Use "previous" or "next".`);
  }
  const before = await getPresentationState(page);
  if (!before.presenting) throw new Error('Present mode is not active');
  const clicked = await page.evaluate((selector) => {
    const control = document.querySelector(selector);
    if (!control) return false;
    control.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  }, selectors[direction]);
  if (!clicked) throw new Error(`${direction} slide control not found`);

  const boundary = direction === 'previous' ? before.activeIndex <= 0 : before.activeIndex >= before.slideCount - 1;
  if (!boundary) {
    await waitFor(page, (oldId) => document.querySelector('.slides-list-group-item.selected')?.id !== oldId,
      { message: `${direction} slide navigation` }, before.activeId);
  }
  // Ayoa selects the list item before its canvas zoom/pan animation settles.
  // A short settle delay prevents screenshots from capturing an in-between frame.
  await sleep(700);
  return getPresentationState(page);
}

async function setCompactMode(page, enabled = true) {
  const state = await getPresentationState(page);
  if (!state.presenting) throw new Error('Present mode is not active');
  if (state.compact === enabled) return state;
  const clicked = await page.evaluate(() => {
    const button = document.querySelector('.slides-compact-button');
    if (!button) return false;
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  });
  if (!clicked) throw new Error('Compact presentation control not found');
  await waitFor(page, (expected) => {
    const panel = document.querySelector('.slides-list-container');
    return Boolean(panel?.classList.contains('compact') || document.querySelector('.slides-compact-button.selected')) === expected;
  }, { message: `compact mode=${enabled}` }, enabled);
  return getPresentationState(page);
}

async function setFullscreenMode(page, enabled = true) {
  const state = await getPresentationState(page);
  if (!state.presenting) throw new Error('Present mode is not active');
  if (state.fullscreen === enabled) return state;
  const clicked = await page.evaluate(() => {
    const button = document.querySelector('.slides-fullscreen-button');
    if (!button) return false;
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  });
  if (!clicked) throw new Error('Fullscreen presentation control not found');
  await waitFor(page, (expected) => Boolean(
    document.fullscreenElement ||
    document.querySelector('#app-content.presenter-fullscreen') ||
    document.querySelector('.slides-fullscreen-button.selected')
  ) === expected, { message: `fullscreen mode=${enabled}` }, enabled);
  return getPresentationState(page);
}

async function openMoreMenu(page) {
  return await page.evaluate(() => {
    const trigger = document.querySelector('.slides-header-more-button');
    if (!trigger) return false;
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  });
}

async function closeMoreMenu(page) {
  // Ayoa closes the menu on outside click. Sending mousedown to body is enough
  // to dismiss it without depending on tooltips or focus state.
  await page.evaluate(() => {
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  });
  await sleep(200);
}

async function clearPresentationDeck(page) {
  // Returns true if the deck ends up empty. Never deletes branches from the map.
  const cleared = await page.evaluate(() => {
    const panel = document.querySelector('.slides-list-container');
    if (!panel) return { status: 'no-panel' };
    const initial = panel.querySelectorAll('.slides-list-group-item').length;
    if (initial === 0) return { status: 'already-empty', removed: 0 };
    const trigger = panel.querySelector('.slides-header-more-button');
    if (!trigger) return { status: 'no-more-button', removed: 0 };
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return { status: 'opened', removed: 0 };
  });
  if (cleared.status === 'no-panel' || cleared.status === 'already-empty') return cleared;
  if (cleared.status === 'no-more-button') return cleared;

  // The dropdown lives in a popper portal; read candidates and click Clear all.
  await sleep(200);
  const click = await page.evaluate(() => {
    const items = document.querySelectorAll('.slides-more-item, .slides-popper-content button, .slides-popper-content .slides-more-item');
    for (const el of items) {
      const text = (el.innerText || '').trim().toLowerCase();
      if (
        text === 'clear all' || text === 'limpar tudo' || text === 'borrar todo' ||
        text === 'clear' || text === 'limpar' || text === 'borrar' ||
        text.startsWith('clear all') || text.startsWith('limpar tudo') || text.startsWith('borrar todo')
      ) {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return true;
      }
    }
    return false;
  });
  if (!click) {
    await closeMoreMenu(page);
    return { status: 'no-clear-action' };
  }

  await waitFor(page, () => {
    const panel = document.querySelector('.slides-list-container');
    return panel ? panel.querySelectorAll('.slides-list-group-item').length === 0 : true;
  }, { message: 'Clear all to empty the presentation deck', timeout: 6000 });
  await closeMoreMenu(page);
  return { status: 'cleared' };
}

async function requestFullPresentation(page) {
  // After Clear all, the empty panel exposes Auto-create / Add all. Confirm the
  // deck is now non-empty. Never use `Add` (single selection) by accident.
  const generated = await autoCreatePresentation(page);
  if (!generated) return { status: 'no-auto-create' };
  const slides = await getSlideList(page);
  if (!slides.length) return { status: 'still-empty' };
  return { status: 'created', slideCount: slides.length };
}

function classifyExistingPresentation({ slides, expectedCount, firstItem, presenting }) {
  if (presenting) return 'state_inconclusive';
  if (!slides || slides.length === 0) return 'presentation_empty';
  if (typeof expectedCount === 'number' && expectedCount > 0) {
    if (slides.length < expectedCount) return 'presentation_partial';
    if (slides.length > expectedCount) return 'presentation_invalid';
    if (!firstItem) return 'presentation_invalid';
  }
  return 'complete_presentation_available';
}

async function getNextControl(page) {
  return await page.evaluate(() => {
    const next = document.querySelector('.slides-nav-container > :last-child');
    if (!next) return { found: false, enabled: false };
    const disabled = next.hasAttribute('disabled') || next.getAttribute('aria-disabled') === 'true';
    return { found: true, enabled: !disabled, text: (next.innerText || '').trim() };
  });
}

async function getPreviousControl(page) {
  return await page.evaluate(() => {
    const prev = document.querySelector('.slides-nav-container > :first-child');
    if (!prev) return { found: false, enabled: false };
    const disabled = prev.hasAttribute('disabled') || prev.getAttribute('aria-disabled') === 'true';
    return { found: true, enabled: !disabled, text: (prev.innerText || '').trim() };
  });
}

async function selectFirstItem(page) {
  const before = await getPresentationState(page);
  if (!before.slideCount) return { status: 'empty-deck' };
  if (before.activeIndex === 0 && before.activeId) {
    return { status: 'already-selected', firstId: before.activeId, firstTitle: before.activeTitle };
  }
  const firstId = before.slides[0].id;
  const ok = await navigateToSlide(page, firstId);
  if (!ok) return { status: 'click-failed' };
  await waitFor(page, (expected) => document.querySelector('.slides-list-group-item.selected')?.id === expected,
    { message: 'first slide selected' }, firstId);
  await sleep(400);
  const after = await getPresentationState(page);
  return { status: 'selected', firstId: after.activeId, firstTitle: after.activeTitle };
}

async function hasForwardControl(page) {
  const next = await getNextControl(page);
  if (!next.found) return false;
  return next.enabled;
}

async function confirmStepChange(page, beforeId) {
  return await waitFor(page, (oldId) => document.querySelector('.slides-list-group-item.selected')?.id !== oldId,
    { message: 'step change observed' }, beforeId);
}

async function autoCreatePresentation(page) {
  // Empty Presenter state exposes an "Auto-create" button. Match current and
  // historical localizations, but never click outside the Presenter panel.
  const result = await page.evaluate(() => {
    const panel = document.querySelector('.slides-list-container');
    if (!panel) return { found: false };
    const buttons = panel.querySelectorAll('.slides-list-empty button, button');
    for (const el of buttons) {
      const text = (el.innerText || '').trim().toLowerCase();
      if (
        text.includes('auto-create') ||
        text.includes('auto create') ||
        text.includes('criar automaticamente') ||
        text.includes('criar automaticamen') ||
        text.includes('crear automáticamente') ||
        text.includes('crear automaticamen')
      ) {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return { found: true };
      }
    }
    return { found: false };
  });

  if (!result.found) {
    log('Auto-create button not found');
    return false;
  }

  log('Clicked Presenter Auto-create');
  await sleep(1000);
  await waitFor(page, () => document.querySelectorAll('.slides-list-group-item').length > 0, {
    timeout: 8000,
    message: 'Ayoa Auto-create results',
  });

  const slides = await getSlideList(page);
  log(`After auto-create: ${slides.length} slides`);
  return slides.length > 0;
}

function buildPresentationMachine() {
  return {
    state: 'init',
    history: [],
    evidence: {},
    unexpected: [],
    transitions(state, note) {
      this.history.push({ from: this.state, to: state, at: Date.now(), note });
      this.state = state;
    },
    setEvidence(patch) { Object.assign(this.evidence, patch); },
    pushUnexpected(issue) { this.unexpected.push(issue); },
  };
}

function machineState(machine) {
  return {
    state: machine.state,
    history: machine.history.slice(),
    evidence: { ...machine.evidence },
    unexpected: machine.unexpected.slice(),
  };
}

async function locatePresentControl(page) {
  // Strategy order follows the briefing: name/role, text, tooltip, icon,
  // toolbar context, alternative selectors previously validated.
  return await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll(
      'button, [role="button"], .btn, [aria-label], [title], a[href], .toggle-presenter, [class*="present"]'
    ));
    for (const el of candidates) {
      if (el.disabled) continue;
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      const text = (el.innerText || '').trim().toLowerCase();
      const title = (el.getAttribute('title') || '').toLowerCase();
      const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
      const matchesText = ['present', 'apresent', 'presentation', 'apresenta'].some(p => text.includes(p));
      const matchesAria = aria.includes('present') || aria.includes('apresent');
      const matchesTitle = title.includes('present') || title.includes('apresent');
      const matchesClass = cls.includes('toggle-presenter');
      if (matchesText || matchesAria || matchesTitle || matchesClass) {
        const r = el.getBoundingClientRect();
        return { found: true, tag: el.tagName, text: text.slice(0, 60), x: Math.round(r.x), y: Math.round(r.y) };
      }
    }
    return { found: false };
  });
}

async function verifyPlanCompatibility(page) {
  return await page.evaluate(() => {
    const ready = Boolean(document.querySelector('.toggle-presenter') || document.querySelector('.slides-list-container'));
    return { ready };
  });
}

async function runFullPresentation(page, {
  expectedSlideCount = null,
  onStepChange = null,
} = {}) {
  const machine = buildPresentationMachine();
  const timeline = [];
  const visited = [];

  const logTransition = (label, detail = {}) => {
    machine.transitions(label, label);
    timeline.push({ state: machine.state, history: machine.history.slice(), detail });
  };

  const finish = (extra = {}) => ({
    ...machineState(machine),
    timeline,
    visited,
    finalState: machine.evidence.stopped || machine.evidence.lastVisited || null,
    ...extra,
  });

  timeline.push({ state: machine.state, history: machine.history.slice(), detail: { kind: 'init' } });

  // 1. Availability.
  const plan = await verifyPlanCompatibility(page);
  machine.setEvidence({ plan_ready: plan.ready });
  if (!plan.ready) {
    logTransition('blocked', { reason: 'present_control_not_found_or_map_unloaded' });
    return finish();
  }
  logTransition('map_loaded');

  // 2. Open present window.
  const control = await locatePresentControl(page);
  machine.setEvidence({ present_control: control });
  if (!control.found) {
    logTransition('blocked', { reason: 'present_control_not_found' });
    return finish();
  }
  logTransition('present_control_found');
  const opened = await openPresenter(page);
  machine.setEvidence({ openedSlides: opened.length });
  logTransition('present_window_open', { slides: opened.length });

  // 3. Evaluate existing presentation. Stop only after the classification
  //    succeeds, otherwise a stuck `presenting=true` blocks the entire run.
  const stateBefore = await getPresentationState(page);
  if (stateBefore.presenting) {
    machine.setEvidence({ classification: 'state_inconclusive', reason: 'present_mode_already_active' });
    logTransition('presentation_state_checked', { classification: 'state_inconclusive' });
    logTransition('blocked', { reason: 'present_mode_already_active' });
    await stopPresentation(page);
    return finish();
  }
  const classification = classifyExistingPresentation({
    slides: stateBefore.slides,
    expectedCount: expectedSlideCount,
    firstItem: stateBefore.slides[0] || null,
    presenting: stateBefore.presenting,
  });
  machine.setEvidence({ classification, slideCount: stateBefore.slideCount });
  logTransition('presentation_state_checked', { classification });

  if (classification === 'complete_presentation_available') {
    logTransition('complete_presentation_available');
  } else {
    logTransition('cleanup_required', { classification });
    const cleared = await clearPresentationDeck(page);
    machine.setEvidence({ cleared: cleared.status });
    if (!['cleared', 'already-empty'].includes(cleared.status)) {
      logTransition('blocked', { reason: `clear_failed:${cleared.status}` });
      return finish();
    }
    if (cleared.status === 'cleared') logTransition('presentation_cleared');

    const created = await requestFullPresentation(page);
    machine.setEvidence({ created: created.status, expectedSlideCount });
    if (created.status !== 'created') {
      logTransition('blocked', { reason: `full_creation_failed:${created.status}` });
      return finish();
    }
    if (typeof expectedSlideCount === 'number' && created.slideCount < expectedSlideCount) {
      logTransition('blocked', { reason: 'partial_after_auto_create' });
      return finish();
    }
    logTransition('full_presentation_requested', { slideCount: created.slideCount });
    const expectedCount = created.slideCount;
    await waitFor(page, (n) => document.querySelectorAll('.slides-list-group-item').length === n,
      { message: 'deck settled after Auto-create', timeout: 8000 }, expectedCount);
    logTransition('full_presentation_validated', { slideCount: expectedCount });
  }

  // 4. Select the first item.
  const selected = await selectFirstItem(page);
  machine.setEvidence({ firstItem: selected });
  if (!['selected', 'already-selected'].includes(selected.status)) {
    logTransition('blocked', { reason: `first_item_failed:${selected.status}` });
    return finish();
  }
  logTransition('first_item_selected', selected);

  // 5. Start.
  const start = await startPresentation(page, { startAt: 1 });
  machine.setEvidence({ start });
  if (!start.presenting) {
    logTransition('blocked', { reason: 'start_failed' });
    return finish();
  }
  logTransition('start_control_found');
  logTransition('present_mode_confirmed', { firstId: start.activeId, firstTitle: start.activeTitle });

  // 6. Navigate forward until the next control is disabled/absent.
  let stepCounter = 0;
  let forwardEnabled = await hasForwardControl(page);
  logTransition('current_step_identified', { step: stepCounter, activeId: start.activeId, activeTitle: start.activeTitle });
  logTransition('next_control_found', { enabled: forwardEnabled });

  while (forwardEnabled) {
    const before = await getPresentationState(page);
    const beforeId = before.activeId;
    if (!beforeId) break;
    logTransition('advancing', { from: beforeId });
    await page.evaluate(() => {
      const next = document.querySelector('.slides-nav-container > :last-child');
      if (next) next.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    stepCounter += 1;
    try {
      await confirmStepChange(page, beforeId);
    } catch (error) {
      machine.pushUnexpected(`step_change_timeout: ${error.message}`);
      break;
    }
    const after = await getPresentationState(page);
    const advancedExactlyOne = after.activeIndex === before.activeIndex + 1;
    if (!advancedExactlyOne) {
      machine.pushUnexpected(`unexpected_advance: ${before.activeIndex} -> ${after.activeIndex}`);
    }
    logTransition('step_change_confirmed', {
      from: beforeId, to: after.activeId, advancedExactlyOne, step: after.activeIndex,
    });
    visited.push({ from: beforeId, to: after.activeId, step: after.activeIndex });
    machine.setEvidence({ lastVisited: after });
    if (onStepChange) await onStepChange(after);
    forwardEnabled = await hasForwardControl(page);
    logTransition('next_control_found', { enabled: forwardEnabled, step: after.activeIndex });
  }

  const last = await getPresentationState(page);
  if (last.activeIndex !== Math.max(0, last.slideCount - 1) && last.slideCount > 0) {
    machine.pushUnexpected(`last_step_unreached: activeIndex=${last.activeIndex}/${last.slideCount - 1}`);
  } else {
    logTransition('last_step_reached', { lastIndex: last.activeIndex, slideCount: last.slideCount });
  }
  if (!machine.evidence.lastVisited) {
    machine.setEvidence({ lastVisited: last });
  }

  // 7. Stop and confirm.
  const stopped = await stopPresentation(page);
  machine.setEvidence({ stopped });
  if (stopped.presenting) {
    logTransition('blocked', { reason: 'stop_failed' });
    return finish();
  }
  if (expectedSlideCount && stopped.slideCount < expectedSlideCount) {
    machine.setEvidence({ deckAfterStop: stopped.slideCount });
  }
  logTransition('presentation_stopped');
  logTransition('presentation_completed');

  return finish();
}

// Main
if (require.main === module) {
  (async () => {
    const login = require('./ayoa-login.js');
    const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8')).map(c => ({
      name: c.name, value: c.value,
      domain: c.domain || '.ayoa.com',
      path: c.path || '/',
      httpOnly: c.httpOnly || false, secure: c.secure || false,
      sameSite: (c.sameSite || 'Lax').charAt(0).toUpperCase() + (c.sameSite || 'Lax').slice(1),
    }));

    const browser = await login.launchBrowser();
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);
    await page.setUserAgent('Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.182 Safari/537.36');

    await login.login(page, cookies);
    await login.navigateToMindmap(page, TARGET);

    if (MODE === 'open' || MODE === 'list') {
      const slides = await openPresenter(page);
      // Output JSON to stdout (pure, no log prefixes)
      console.log(JSON.stringify(slides));
    }

    if (MODE === 'nav') {
      const slides = await openPresenter(page);
      const from = parseInt(ARGS.from) || 1;
      const to = parseInt(ARGS.to) || slides.length;
      
      for (let i = from - 1; i < Math.min(to, slides.length); i++) {
        const ok = await navigateToSlide(page, slides[i].id);
        log(`Slide ${i+1}/${slides.length}: ${ok ? 'OK' : 'FAIL'} — ${slides[i].title.substring(0, 50)}`);
        await sleep(1000);
      }
    }

    if (MODE === 'prepare') {
      console.log(JSON.stringify(await preparePresentation(page, { autoCreate: true })));
    }

    if (MODE === 'present') {
      const action = ARGS.action || 'start';
      let state;
      if (action === 'start') {
        state = await startPresentation(page, { startAt: parseInt(ARGS['start-at']) || 1 });
      } else if (action === 'next' || action === 'previous') {
        await startPresentation(page, { startAt: parseInt(ARGS['start-at']) || 1 });
        state = await navigatePresentation(page, action);
      } else if (action === 'stop') {
        state = await stopPresentation(page);
      } else {
        throw new Error(`Unknown --action ${action}; use start, next, previous, or stop`);
      }
      if (ARGS.compact) state = await setCompactMode(page, true);
      if (ARGS.fullscreen) state = await setFullscreenMode(page, true);
      if (ARGS.screenshot) await page.screenshot({ path: ARGS.screenshot });
      console.log(JSON.stringify(state));
    }

    if (MODE === 'run') {
      const expected = ARGS['expected-count'] ? parseInt(ARGS['expected-count']) : null;
      const result = await runFullPresentation(page, { expectedSlideCount: expected });
      if (ARGS.screenshot) await page.screenshot({ path: ARGS.screenshot });
      console.log(JSON.stringify(result));
    }

    await browser.close();
    log('Done');
  })().catch(e => { console.error('FATAL:', e); process.exit(1); });
}

module.exports = {
  openPresenter,
  getSlideList,
  navigateToSlide,
  clickPlayButton,
  autoCreatePresentation,
  preparePresentation,
  getPresentationState,
  startPresentation,
  stopPresentation,
  navigatePresentation,
  setCompactMode,
  setFullscreenMode,
  clearPresentationDeck,
  requestFullPresentation,
  classifyExistingPresentation,
  getNextControl,
  getPreviousControl,
  hasForwardControl,
  confirmStepChange,
  selectFirstItem,
  locatePresentControl,
  verifyPlanCompatibility,
  runFullPresentation,
  buildPresentationMachine,
  machineState,
};
