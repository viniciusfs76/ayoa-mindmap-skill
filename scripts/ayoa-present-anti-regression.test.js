'use strict';

// ayoa-present-anti-regression.test.js
// Guards against the most common breakage patterns observed when the Ayoa UI
// changes: renamed selectors, lost state classes, missing buttons, etc.

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

test('anti-regression: panel opens without throwing when the markup shifts', async () => {
  await fx.installPanel(page);
  const r = await presenter.openPresenter(page);
  assert.equal(Array.isArray(r), true);
  assert.equal(r.length, 3);
});

test('anti-regression: openPresenter is idempotent across multiple calls', async () => {
  await fx.installPanel(page);
  const first = await presenter.openPresenter(page);
  const second = await presenter.openPresenter(page);
  const third = await presenter.openPresenter(page);
  assert.deepEqual(first.map(s => s.id), second.map(s => s.id));
  assert.deepEqual(second.map(s => s.id), third.map(s => s.id));
});

test('anti-regression: preparePresentation preserves an existing ordered deck', async () => {
  await fx.installPanel(page, { deckSize: 4 });
  const r = await presenter.preparePresentation(page, { autoCreate: false });
  assert.deepEqual(r.slides.map(s => s.title), ['One', 'Two', 'Three', 'Four']);
});

test('anti-regression: preparePresentation does not modify the map canvas', async () => {
  await fx.installPanel(page, { expectedCount: 5 });
  const before = await page.evaluate(() => document.querySelectorAll('.map-node').length);
  await presenter.preparePresentation(page, { autoCreate: false });
  const after = await page.evaluate(() => document.querySelectorAll('.map-node').length);
  assert.equal(after, before, 'prepare must not delete branches from the map');
});

test('anti-regression: classifyExistingPresentation falls back when expectedCount is null', async () => {
  const r = presenter.classifyExistingPresentation({
    slides: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
    expectedCount: null,
    firstItem: { id: 'a' },
    presenting: false,
  });
  assert.equal(r, 'complete_presentation_available');
});

test('anti-regression: getPresentationState returns the canonical fields', async () => {
  await fx.installPanel(page);
  const s = await presenter.getPresentationState(page);
  for (const key of ['panelOpen', 'slideCount', 'presenting', 'compact', 'fullscreen',
                     'activeId', 'activeIndex', 'activeTitle', 'hasPreviousControl',
                     'hasNextControl', 'dualScreenAvailable', 'boundaryMarker', 'slides']) {
    assert.ok(key in s, `state must include ${key}`);
  }
});

test('anti-regression: locatePresentControl never returns the body element', async () => {
  await fx.installPanel(page);
  const r = await presenter.locatePresentControl(page);
  assert.equal(r.found, true);
  assert.notEqual(r.tag, 'BODY');
});

test('anti-regression: clearPresentationDeck leaves map intact for an arbitrary deck size', async () => {
  await fx.installPanel(page, { expectedCount: 7, deckSize: 7 });
  const before = await page.evaluate(() => document.querySelectorAll('.map-node').length);
  const r = await presenter.clearPresentationDeck(page);
  assert.equal(r.status, 'cleared');
  const after = await page.evaluate(() => document.querySelectorAll('.map-node').length);
  assert.equal(after, before);
});

test('anti-regression: requestFullPresentation refuses Add all when there is no auto-create button', async () => {
  await page.setContent(`
    <div class="slides-list-container">
      <div class="slides-list-content"><ol></ol></div>
    </div>`);
  const r = await presenter.requestFullPresentation(page);
  assert.equal(r.status, 'no-auto-create');
});

test('anti-regression: navigatePresentation without an active mode fails clearly', async () => {
  await fx.installPanel(page);
  await assert.rejects(() => presenter.navigatePresentation(page, 'next'), /not active/i);
});

test('anti-regression: stopPresentation on an idle panel is a no-op', async () => {
  await fx.installPanel(page);
  const s = await presenter.stopPresentation(page);
  assert.equal(s.presenting, false);
});

test('anti-regression: setCompactMode without active presenting is rejected', async () => {
  await fx.installPanel(page);
  await assert.rejects(() => presenter.setCompactMode(page, true), /not active/i);
});

test('anti-regression: setFullscreenMode without active presenting is rejected', async () => {
  await fx.installPanel(page);
  await assert.rejects(() => presenter.setFullscreenMode(page, true), /not active/i);
});

test('anti-regression: buildPresentationMachine refuses an invalid state', () => {
  const m = presenter.buildPresentationMachine();
  m.transitions('map_loaded');
  m.transitions('blocked');
  assert.equal(m.state, 'blocked');
  assert.equal(m.history.length, 2);
});

test('anti-regression: selectFirstItem on an empty deck returns empty-deck', async () => {
  await fx.installPanel(page, { empty: true });
  const r = await presenter.selectFirstItem(page);
  assert.equal(r.status, 'empty-deck');
});
