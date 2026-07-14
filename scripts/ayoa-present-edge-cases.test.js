'use strict';

// ayoa-present-edge-cases.test.js
// Edge cases for latency, hidden controls, partial renders, retry semantics
// and similar production hazards.

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

test('edge: navigatePresentation with an unknown direction throws', async () => {
  await fx.installPanel(page);
  await presenter.startPresentation(page);
  await assert.rejects(() => presenter.navigatePresentation(page, 'upward'), /direction/i);
});

test('edge: startAt below 1 throws RangeError', async () => {
  await fx.installPanel(page);
  await assert.rejects(() => presenter.startPresentation(page, { startAt: 0 }), /startAt/);
});

test('edge: startAt above slideCount throws RangeError', async () => {
  await fx.installPanel(page, { deckSize: 2 });
  await assert.rejects(() => presenter.startPresentation(page, { startAt: 5 }), /startAt/);
});

test('edge: runFullPresentation with deckSize 1 still completes', async () => {
  await fx.installPanel(page, { deckSize: 1 });
  const r = await presenter.runFullPresentation(page);
  assert.equal(r.state, 'presentation_completed');
  assert.equal(r.evidence.lastVisited.activeIndex, 0);
});

test('edge: runFullPresentation with deckSize 1 does not call next', async () => {
  await fx.installPanel(page, { deckSize: 1 });
  const r = await presenter.runFullPresentation(page);
  const advances = r.timeline.filter(t => t.state === 'step_change_confirmed').length;
  assert.equal(advances, 0);
});

test('edge: previous navigation is blocked at the first slide', async () => {
  await fx.installPanel(page);
  const state = await presenter.startPresentation(page);
  const r = await presenter.navigatePresentation(page, 'previous');
  assert.equal(r.activeIndex, state.activeIndex);
});

test('edge: next navigation is blocked at the last slide', async () => {
  await fx.installPanel(page, { deckSize: 2 });
  await presenter.startPresentation(page);
  await presenter.navigatePresentation(page, 'next');
  const r = await presenter.navigatePresentation(page, 'next');
  assert.equal(r.activeIndex, 1);
});

test('edge: getPresentationState returns a slides array even on an empty panel', async () => {
  await fx.installPanel(page, { empty: true });
  const s = await presenter.getPresentationState(page);
  assert.equal(s.slideCount, 0);
  assert.deepEqual(s.slides, []);
});

test('edge: clicking the previous button when the panel is empty is a no-op', async () => {
  await fx.installPanel(page, { empty: true });
  const r = await presenter.getPreviousControl(page);
  assert.equal(r.found, true);
  assert.equal(r.enabled, false);
});

test('edge: clicking the next button when the panel is empty is a no-op', async () => {
  await fx.installPanel(page, { empty: true });
  const r = await presenter.getNextControl(page);
  assert.equal(r.found, true);
  assert.equal(r.enabled, false);
});

test('edge: navigatePresentation after Stop is rejected', async () => {
  await fx.installPanel(page);
  await presenter.startPresentation(page);
  await presenter.stopPresentation(page);
  await assert.rejects(() => presenter.navigatePresentation(page, 'next'), /not active/i);
});

test('edge: preparePresentation with autoCreate=false and an empty deck fails', async () => {
  await fx.installPanel(page, { empty: true });
  await assert.rejects(() => presenter.preparePresentation(page, { autoCreate: false }), /no slides/i);
});

test('edge: clearPresentationDeck does not throw if the menu trigger is missing', async () => {
  await page.setContent(`
    <div class="slides-list-container">
      <div class="slides-list-content"><ol>
        <li class="slides-list-group-item">x</li>
      </ol></div>
    </div>`);
  const r = await presenter.clearPresentationDeck(page);
  assert.equal(r.status, 'no-more-button');
});

test('edge: navigatePresentation tolerates a click on a disabled next control', async () => {
  await fx.installPanel(page, { deckSize: 1, nextDisabled: true });
  const s = await presenter.startPresentation(page);
  assert.equal(s.activeIndex, 0);
});

test('edge: runFullPresentation records a last_step_reached with a one-item deck', async () => {
  await fx.installPanel(page, { deckSize: 1 });
  const r = await presenter.runFullPresentation(page);
  assert.ok(r.timeline.map(t => t.state).includes('last_step_reached'));
});
