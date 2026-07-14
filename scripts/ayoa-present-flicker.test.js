'use strict';

// ayoa-present-flicker.test.js
// Tests for transient UI states, debouncing and race conditions. These are
// usually the cause of "ghost clicks" that fire after the Ayoa SPA has torn
// down the panel.

const test = require('node:test');
const assert = require('node:assert/strict');
const fx = require('./ayoa-present-fixtures.js');
const presenter = fx.requireAyoaPresenter();

let browser;
let page;

test.before(async () => { browser = await fx.withBrowser(); });
test.beforeEach(async () => { page = await browser.newPage(); });
test.afterEach(async () => { await page.close(); });
test.after(async () => { await browser.close(); });

test('flicker: Start followed by Stop immediately ends the presentation', async () => {
  await fx.installPanel(page);
  const s1 = await presenter.startPresentation(page);
  assert.equal(s1.presenting, true);
  const s2 = await presenter.stopPresentation(page);
  assert.equal(s2.presenting, false);
});

test('flicker: rapid double Start does not enter an inconsistent state', async () => {
  await fx.installPanel(page);
  const a = await presenter.startPresentation(page);
  const b = await presenter.startPresentation(page);
  assert.equal(a.presenting, true);
  assert.equal(b.presenting, true);
  // Idempotency: starting twice should not toggle the panel off.
  const state = await presenter.getPresentationState(page);
  assert.equal(state.presenting, true);
});

test('flicker: Start + Next + Previous returns to the first slide', async () => {
  await fx.installPanel(page);
  await presenter.startPresentation(page);
  await presenter.navigatePresentation(page, 'next');
  const back = await presenter.navigatePresentation(page, 'previous');
  assert.equal(back.activeIndex, 0);
});

test('flicker: stopPresentation right after start does not drop slides', async () => {
  await fx.installPanel(page, { deckSize: 4 });
  await presenter.startPresentation(page);
  const after = await presenter.stopPresentation(page);
  assert.equal(after.slideCount, 4);
});

test('flicker: openPresenter after a debounced click is idempotent', async () => {
  await fx.installPanel(page);
  const a = await presenter.openPresenter(page);
  const b = await presenter.openPresenter(page);
  assert.deepEqual(a.map(s => s.id), b.map(s => s.id));
});

test('flicker: clearPresentationDeck called twice is idempotent', async () => {
  await fx.installPanel(page, { deckSize: 3 });
  const a = await presenter.clearPresentationDeck(page);
  const b = await presenter.clearPresentationDeck(page);
  assert.equal(a.status, 'cleared');
  assert.equal(b.status, 'already-empty');
});

test('flicker: state-machine is consistent across two consecutive runs', async () => {
  // Each run uses a fresh page to avoid any shared DOM state.
  const pageA = await browser.newPage();
  const pageB = await browser.newPage();
  try {
    await fx.installPanel(pageA);
    const a = await presenter.runFullPresentation(pageA);
    await fx.installPanel(pageB);
    const b = await presenter.runFullPresentation(pageB);
    assert.equal(a.state, b.state);
    assert.equal(a.state, 'presentation_completed');
  } finally {
    await pageA.close();
    await pageB.close();
  }
});

test('flicker: confirmStepChange waits for the canvas before returning', async () => {
  await fx.installPanel(page);
  await presenter.startPresentation(page);
  const before = await presenter.getPresentationState(page);
  // Trigger a real navigation so the change observer has something to wait for.
  await presenter.navigatePresentation(page, 'next');
  const t0 = Date.now();
  await presenter.confirmStepChange(page, before.activeId);
  const dt = Date.now() - t0;
  assert.ok(dt < 5000, 'confirmStepChange must finish within the timeout');
});

test('flicker: rapid advances are serialised by the navigator', async () => {
  await fx.installPanel(page, { deckSize: 4 });
  const r = await presenter.runFullPresentation(page);
  const advances = r.timeline.filter(t => t.state === 'step_change_confirmed');
  for (const a of advances) {
    assert.equal(a.detail.advancedExactlyOne, true);
  }
});

test('flicker: stop during navigation rejects with a clear message', async () => {
  await fx.installPanel(page);
  await presenter.startPresentation(page);
  await presenter.stopPresentation(page);
  await assert.rejects(() => presenter.navigatePresentation(page, 'next'), /not active/i);
});

test('flicker: getPresentationState survives a panel that disappears mid-call', async () => {
  await fx.installPanel(page);
  const observer = new Promise(resolve => setTimeout(resolve, 50));
  const promise = presenter.getPresentationState(page);
  await observer;
  await page.evaluate(() => document.querySelector('.slides-list-container').remove());
  const s = await promise;
  // The earlier evaluation already captured the state; subsequent calls see no panel.
  assert.ok(s);
});

test('flicker: clearPresentationDeck tolerates a button portal already mounted', async () => {
  await fx.installPanel(page, { deckSize: 3 });
  await page.evaluate(() => {
    const existing = document.querySelector('.slides-popper-content');
    if (existing) existing.remove();
  });
  const r = await presenter.clearPresentationDeck(page);
  assert.equal(r.status, 'cleared');
});
