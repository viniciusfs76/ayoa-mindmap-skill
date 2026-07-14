'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const puppeteer = require('puppeteer-core');

const PREFIX = process.env.PREFIX || '/data/data/com.termux/files/usr';
const CHROME_PATH = `${PREFIX}/lib/chromium/headless_shell`;
const presenter = require('./ayoa-presenter.js');

let browser;
let page;

async function fixture({ empty = false, expectedCount = 3, deckSize = 3 } = {}) {
  await page.setContent(`
    <div id="app-content">
      <div class="toggle-presenter"></div>
      <div class="map-canvas">
        <div class="map-node mainidea" data-branch="central">Central</div>
        ${[...Array(expectedCount).keys()].map(i => `<div class="map-node" data-branch="b${i+1}">Branch ${i+1}</div>`).join('')}
      </div>
      <div class="slides-list-container">
        <div class="slides-list-header">
          <div class="slides-list-title"><span>Presenter</span><div class="help-icon"></div></div>
          <div class="slides-header-add-button"><button class="btn btn-default disabled">Add</button></div>
          <div class="slides-header-more-button"><div class="more-trigger"><i class="icon-dt_more"></i></div></div>
        </div>
        <div class="slides-list-content">
          <ol>${empty ? '' : Array.from({ length: deckSize }, (_, i) => `
            <li id="slide-${i+1}" class="slides-list-group-item${i === 0 ? ' selected' : ''}" draggable="true"><div class="slides-list-group-counter">${i+1}</div><div class="slides-list-group-content">${['One','Two','Three','Four','Five'][i] || ('Slide ' + (i+1))}</div></li>`).join('')}
          </ol>
          ${empty ? '<div class="slides-list-empty"><button class="btn btn-default">Auto-create</button></div>' : ''}
        </div>
        <div class="slides-list-footer">
          <button class="btn btn-default slides-play-stop-button"></button>
          <div class="slides-nav-container">
            <button class="previous" aria-label="Previous slide" disabled></button>
            <button class="next" aria-label="Next slide"></button>
          </div>
          <button class="btn btn-default slides-popout-button"></button>
          <button class="btn btn-default slides-compact-button"></button>
          <button class="btn btn-default slides-fullscreen-button"></button>
        </div>
      </div>
    </div>
    <script>
      const panel = document.querySelector('.slides-list-container');
      const play = document.querySelector('.slides-play-stop-button');
      const nextBtn = document.querySelector('.slides-nav-container .next');
      const prevBtn = document.querySelector('.slides-nav-container .previous');
      const moreTrigger = document.querySelector('.slides-header-more-button');
      const selected = () => document.querySelector('.slides-list-group-item.selected');
      const select = (el) => {
        document.querySelectorAll('.slides-list-group-item').forEach(x => x.classList.remove('selected'));
        if (el) el.classList.add('selected');
        updateNavState();
      };
      const items = () => [...document.querySelectorAll('.slides-list-group-item')];
      const updateNavState = () => {
        const i = items().indexOf(selected());
        nextBtn.disabled = i === -1 || i >= items().length - 1;
        prevBtn.disabled = i <= 0;
      };
      document.querySelectorAll('.slides-list-group-item').forEach(el => el.addEventListener('click', () => select(el)));
      play.addEventListener('click', () => {
        const active = panel.classList.toggle('presenting');
        play.classList.toggle('selected', active);
        if (active) setTimeout(() => { select(document.querySelector('.slides-list-group-item')); updateNavState(); }, 200);
      });
      nextBtn.addEventListener('click', () => {
        const all = items();
        const i = all.indexOf(selected()); select(all[Math.min(all.length - 1, i + 1)]);
      });
      prevBtn.addEventListener('click', () => {
        const all = items();
        const i = all.indexOf(selected()); select(all[Math.max(0, i - 1)]);
      });
      let savedSlides = '';
      document.querySelector('.slides-compact-button').addEventListener('click', e => {
        const content = panel.querySelector('.slides-list-content');
        const enabling = !panel.classList.contains('compact');
        panel.classList.toggle('compact', enabling); e.currentTarget.classList.toggle('selected', enabling);
        if (enabling) { savedSlides = content.innerHTML; content.innerHTML = ''; }
        else { content.innerHTML = savedSlides; }
      });
      document.querySelector('.slides-fullscreen-button').addEventListener('click', e => {
        document.querySelector('#app-content').classList.toggle('presenter-fullscreen');
        e.currentTarget.classList.toggle('selected');
      });
      const openMenu = () => {
        const existing = document.querySelector('.slides-popper-content');
        if (existing) existing.remove();
        const portal = document.createElement('div');
        portal.className = 'slides-popper-content';
        const clear = document.createElement('div');
        clear.className = 'slides-more-item';
        clear.innerText = 'Clear all';
        clear.addEventListener('click', () => {
          document.querySelectorAll('.slides-list-group-item').forEach(el => el.remove());
          portal.remove();
          if (!document.querySelector('.slides-list-content ol').children.length) {
            let empty = document.querySelector('.slides-list-empty');
            if (!empty) {
              empty = document.createElement('div');
              empty.className = 'slides-list-empty';
              const btn = document.createElement('button');
              btn.className = 'btn btn-default';
              btn.innerText = 'Auto-create';
              btn.addEventListener('click', () => {
                const ol = document.querySelector('ol');
                ['Auto one','Auto two','Auto three'].forEach((name, i) => {
                  const li = document.createElement('li'); li.id = 'auto-' + (i + 1);
                  li.className = 'slides-list-group-item' + (i === 0 ? ' selected' : '');
                  li.innerHTML = '<div class="slides-list-group-counter">' + (i + 1) + '</div><div class="slides-list-group-content">' + name + '</div>';
                  li.addEventListener('click', () => select(li));
                  ol.appendChild(li);
                });
                empty.remove();
                updateNavState();
              });
              empty.appendChild(btn);
              document.querySelector('.slides-list-content').appendChild(empty);
            }
          }
          updateNavState();
        });
        portal.appendChild(clear);
        document.body.appendChild(portal);
      };
      moreTrigger.addEventListener('click', openMenu);
      const moreParent = document.querySelector('.slides-header-more-button');
      if (moreParent && moreParent !== moreTrigger) moreParent.addEventListener('click', openMenu);
      document.querySelector('.slides-list-empty button')?.addEventListener('click', () => {
        const ol = document.querySelector('ol');
        ['Auto one','Auto two','Auto three'].forEach((name, i) => {
          const li = document.createElement('li'); li.id = 'auto-' + (i + 1);
          li.className = 'slides-list-group-item' + (i === 0 ? ' selected' : '');
          li.innerHTML = '<div class="slides-list-group-counter">' + (i + 1) + '</div><div class="slides-list-group-content">' + name + '</div>';
          li.addEventListener('click', () => select(li));
          ol.appendChild(li);
        });
        document.querySelector('.slides-list-empty').remove();
        updateNavState();
      });
      updateNavState();
    </script>
  `);
}

test.before(async () => {
  browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'shell',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process'],
  });
});

test.beforeEach(async () => { page = await browser.newPage(); });
test.afterEach(async () => { await page.close(); });
test.after(async () => { await browser.close(); });

test('preparePresentation returns the ordered existing slide deck', async () => {
  await fixture();
  const result = await presenter.preparePresentation(page, { autoCreate: false });
  assert.equal(result.slideCount, 3);
  assert.deepEqual(result.slides.map(s => s.title), ['One', 'Two', 'Three']);
  assert.equal(result.presenting, false);
});

test('preparePresentation restores preparation state when a previous session was left presenting', async () => {
  await fixture();
  await page.click('.slides-play-stop-button');
  assert.equal((await presenter.getPresentationState(page)).presenting, true);
  const result = await presenter.preparePresentation(page, { autoCreate: false });
  assert.equal(result.presenting, false);
  assert.equal(result.slideCount, 3);
});

test('preparePresentation auto-creates a deck only when it is empty', async () => {
  await fixture({ empty: true });
  const result = await presenter.preparePresentation(page, { autoCreate: true });
  assert.equal(result.slideCount, 3);
  assert.deepEqual(result.slides.map(s => s.title), ['Auto one', 'Auto two', 'Auto three']);
});

test('Present mode starts, navigates next/previous, and stops with verified state', async () => {
  await fixture();
  await presenter.preparePresentation(page, { autoCreate: false });
  let state = await presenter.startPresentation(page);
  assert.equal(state.presenting, true);
  assert.equal(state.activeIndex, 0);

  state = await presenter.navigatePresentation(page, 'next');
  assert.equal(state.activeIndex, 1);
  state = await presenter.navigatePresentation(page, 'previous');
  assert.equal(state.activeIndex, 0);

  state = await presenter.stopPresentation(page);
  assert.equal(state.presenting, false);
});

test('navigation waits for the Ayoa canvas transition before returning', async () => {
  await fixture();
  await presenter.startPresentation(page);
  const started = Date.now();
  const state = await presenter.navigatePresentation(page, 'next');
  assert.equal(state.activeIndex, 1);
  assert.ok(Date.now() - started >= 500, 'navigation returned before the canvas transition settled');
});

test('startAt is deterministic even when Ayoa persisted another active slide', async () => {
  await fixture();
  await page.evaluate(() => {
    document.querySelectorAll('.slides-list-group-item').forEach(x => x.classList.remove('selected'));
    document.getElementById('slide-3').classList.add('selected');
  });
  let state = await presenter.startPresentation(page, { startAt: 1 });
  assert.equal(state.activeIndex, 0);
  state = await presenter.navigatePresentation(page, 'next');
  assert.equal(state.activeIndex, 1);
});

test('startAt is deterministic even when Ayoa resets to the first slide after Start', async () => {
  await fixture();
  let state = await presenter.startPresentation(page, { startAt: 2 });
  assert.equal(state.activeIndex, 1);
});

test('compact and fullscreen presentation views are enabled and restored idempotently', async () => {
  await fixture();
  await presenter.startPresentation(page);
  let state = await presenter.setCompactMode(page, true);
  assert.equal(state.compact, true);
  state = await presenter.setCompactMode(page, true);
  assert.equal(state.compact, true);
  state = await presenter.setCompactMode(page, false);
  assert.equal(state.compact, false);

  state = await presenter.setFullscreenMode(page, true);
  assert.equal(state.fullscreen, true);
  state = await presenter.setFullscreenMode(page, false);
  assert.equal(state.fullscreen, false);
});

test('compact mode preserves logical deck state when Ayoa unmounts the slide list', async () => {
  await fixture();
  let state = await presenter.startPresentation(page);
  assert.equal(state.slideCount, 3);
  assert.equal(state.activeIndex, 0);

  state = await presenter.setCompactMode(page, true);
  assert.equal(state.compact, true);
  assert.equal(state.slideCount, 3);
  assert.equal(state.activeIndex, 0);
  assert.equal(state.activeTitle, 'One');
});

test('invalid navigation direction fails clearly', async () => {
  await fixture();
  await presenter.startPresentation(page);
  await assert.rejects(() => presenter.navigatePresentation(page, 'sideways'), /direction/i);
});

test('classifyExistingPresentation categorises the four primary states', () => {
  assert.equal(presenter.classifyExistingPresentation({ slides: [], expectedCount: 3, firstItem: null, presenting: false }),
    'presentation_empty');
  assert.equal(presenter.classifyExistingPresentation({
    slides: [{ id: 'a' }], expectedCount: 3, firstItem: { id: 'a' }, presenting: false,
  }), 'presentation_partial');
  assert.equal(presenter.classifyExistingPresentation({
    slides: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }], expectedCount: 3,
    firstItem: { id: 'a' }, presenting: false,
  }), 'presentation_invalid');
  assert.equal(presenter.classifyExistingPresentation({
    slides: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], expectedCount: 3,
    firstItem: { id: 'a' }, presenting: false,
  }), 'complete_presentation_available');
  assert.equal(presenter.classifyExistingPresentation({
    slides: [{ id: 'a' }], expectedCount: null, firstItem: null, presenting: true,
  }), 'state_inconclusive');
});

test('clearPresentationDeck empties the deck but preserves the map', async () => {
  await fixture({ expectedCount: 4 });
  const before = await page.evaluate(() => document.querySelectorAll('.map-node').length);
  const result = await presenter.clearPresentationDeck(page);
  assert.equal(result.status, 'cleared');
  const state = await presenter.getPresentationState(page);
  assert.equal(state.slideCount, 0);
  const after = await page.evaluate(() => document.querySelectorAll('.map-node').length);
  assert.equal(after, before, 'Clear all must not delete branches from the map');
});

test('clearPresentationDeck is idempotent on an already-empty deck', async () => {
  await fixture({ empty: true });
  const result = await presenter.clearPresentationDeck(page);
  assert.equal(['already-empty', 'cleared'].includes(result.status), true);
});

test('locatePresentControl finds the present button by class, text and ARIA', async () => {
  await page.setContent('<button class="toggle-presenter" aria-label="Present"></button>');
  const r = await presenter.locatePresentControl(page);
  assert.equal(r.found, true);
});

test('locatePresentControl returns not found when the button is absent', async () => {
  await page.setContent('<button class="other"></button>');
  const r = await presenter.locatePresentControl(page);
  assert.equal(r.found, false);
});

test('verifyPlanCompatibility requires the toggle-presenter or panel', async () => {
  await page.setContent('<div></div>');
  const empty = await presenter.verifyPlanCompatibility(page);
  assert.equal(empty.ready, false);
  await page.setContent('<div class="toggle-presenter"></div>');
  const ready = await presenter.verifyPlanCompatibility(page);
  assert.equal(ready.ready, true);
});

test('runFullPresentation preserves a complete presentation and walks the full sequence', async () => {
  await fixture({ expectedCount: 3 });
  const visits = [];
  const result = await presenter.runFullPresentation(page, {
    expectedSlideCount: 3,
    onStepChange: async (s) => { visits.push(s.activeId); },
  });
  const states = result.timeline.map(t => t.state);
  assert.ok(states.includes('init'), 'timeline deve registrar init');
  assert.ok(states.includes('present_window_open'));
  assert.ok(states.includes('complete_presentation_available'));
  assert.ok(states.includes('present_mode_confirmed'));
  assert.ok(states.includes('last_step_reached'));
  assert.ok(states.includes('presentation_completed'));
  assert.equal(result.evidence.lastVisited.activeIndex, 2);
  assert.equal(visits.length, 2);
  assert.equal(result.unexpected.length, 0);
  const state = await presenter.getPresentationState(page);
  assert.equal(state.presenting, false);
  assert.equal(state.slideCount, 3);
});

test('runFullPresentation rebuilds the deck when the existing one is partial', async () => {
  await fixture({ expectedCount: 3 });
  // Force a partial deck: keep only the first slide.
  await page.evaluate(() => {
    document.querySelectorAll('.slides-list-group-item').forEach((el, i) => { if (i > 0) el.remove(); });
  });
  const result = await presenter.runFullPresentation(page, { expectedSlideCount: 3 });
  const states = result.timeline.map(t => t.state);
  assert.ok(states.includes('cleanup_required'));
  assert.ok(states.includes('presentation_cleared'));
  assert.ok(states.includes('full_presentation_requested'));
  assert.ok(states.includes('full_presentation_validated'));
  const state = await presenter.getPresentationState(page);
  assert.equal(state.slideCount, 3);
});

test('runFullPresentation rebuilds the deck when it is empty', async () => {
  await fixture({ empty: true });
  const result = await presenter.runFullPresentation(page, { expectedSlideCount: 3 });
  const states = result.timeline.map(t => t.state);
  assert.ok(states.includes('cleanup_required'));
  assert.ok(states.includes('full_presentation_requested'));
  const state = await presenter.getPresentationState(page);
  assert.equal(state.slideCount, 3);
});

test('runFullPresentation records exactly one advance per next click', async () => {
  await fixture();
  const result = await presenter.runFullPresentation(page);
  const advances = result.timeline.filter(t => t.state === 'step_change_confirmed');
  for (const ev of advances) {
    assert.equal(ev.detail.advancedExactlyOne, true);
  }
  assert.equal(advances.length, 2);
});

test('runFullPresentation detects the last step when next is disabled', async () => {
  await fixture({ expectedCount: 2, deckSize: 2 });
  const result = await presenter.runFullPresentation(page);
  const states = result.timeline.map(t => t.state);
  assert.ok(states.includes('last_step_reached'));
  assert.equal(result.evidence.lastVisited.activeIndex, 1);
});

test('runFullPresentation blocks when present control is missing', async () => {
  await page.setContent('<div id="app-content"><div class="map-canvas"></div></div>');
  const result = await presenter.runFullPresentation(page);
  assert.equal(result.state, 'blocked');
  assert.ok(['map_loaded','blocked'].includes(result.timeline[1].state));
});

test('runFullPresentation blocks when Auto-create is not offered on an empty deck', async () => {
  await page.setContent(`
    <div id="app-content">
      <div class="toggle-presenter"></div>
      <div class="slides-list-container">
        <div class="slides-list-header">
          <div class="slides-list-title">Presenter</div>
          <div class="slides-header-more-button"></div>
        </div>
        <div class="slides-list-content">
          <ol></ol>
        </div>
        <div class="slides-list-footer">
          <button class="btn btn-default slides-play-stop-button"></button>
        </div>
      </div>
    </div>
  `);
  const result = await presenter.runFullPresentation(page);
  assert.equal(result.state, 'blocked');
  const states = result.timeline.map(t => t.state);
  assert.ok(states.includes('cleanup_required'));
});

test('runFullPresentation never reduces the deck after stop', async () => {
  await fixture({ expectedCount: 3 });
  const result = await presenter.runFullPresentation(page, { expectedSlideCount: 3 });
  assert.equal(result.finalState.presenting, false);
  assert.equal(result.finalState.slideCount, 3);
});

test('runFullPresentation refuses to start with the panel already in presenting state', async () => {
  await fixture({ expectedCount: 3 });
  await page.click('.slides-play-stop-button');
  const result = await presenter.runFullPresentation(page, { expectedSlideCount: 3 });
  assert.equal(result.state, 'blocked');
  const state = await presenter.getPresentationState(page);
  assert.equal(state.presenting, false);
});

test('buildPresentationMachine tracks history and evidence', () => {
  const m = presenter.buildPresentationMachine();
  m.transitions('map_loaded', 'ready');
  m.setEvidence({ slideCount: 3 });
  m.pushUnexpected('test');
  m.transitions('blocked', 'nope');
  const s = presenter.machineState(m);
  assert.equal(s.state, 'blocked');
  assert.equal(s.history.length, 2);
  assert.deepEqual(s.evidence, { slideCount: 3 });
  assert.equal(s.unexpected.length, 1);
});

test('locatePresentControl accepts the historical "present" ARIA label', async () => {
  await page.setContent('<button class="toggle-presenter" aria-label="Presenting Mode"></button>');
  const r = await presenter.locatePresentControl(page);
  assert.equal(r.found, true);
});

test('getPresentationState surfaces the "blue square" boundary marker when present', async () => {
  await page.setContent(`
    <div class="slides-list-container">
      <div class="slides-list-content">
        <ol>
          <li id="slide-1" class="slides-list-group-item selected">
            <div class="slides-list-group-counter">1</div>
            <div class="slides-list-group-content">One</div>
            <span class="slide-boundary blue-square"></span>
          </li>
        </ol>
      </div>
    </div>
  `);
  const r = await presenter.getPresentationState(page);
  assert.equal(r.boundaryMarker, true);
});

test('runFullPresentation accepts expectedSlideCount=null as a hint to preserve any deck', async () => {
  await fixture();
  const result = await presenter.runFullPresentation(page, { expectedSlideCount: null });
  const states = result.timeline.map(t => t.state);
  assert.ok(states.includes('complete_presentation_available'));
  assert.equal(result.state, 'presentation_completed');
  assert.equal(result.unexpected.length, 0);
});
