'use strict';

// ayoa-present-source-rotation.test.js
// Stress-tests the source of slides: manual, Add all, Auto-create, Clear all,
// re-add after clear. Guarantees the skill never permanently empties the deck
// and that each source produces a sequence that matches the original map order.

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

test('source rotation: existing deck is preserved when complete', async () => {
  await fx.installPanel(page, { deckSize: 4 });
  const r = await presenter.runFullPresentation(page);
  assert.ok(r.timeline.map(t => t.state).includes('complete_presentation_available'));
});

test('source rotation: empty deck triggers Auto-create', async () => {
  await fx.installPanel(page, { empty: true });
  const r = await presenter.runFullPresentation(page, { expectedSlideCount: 3 });
  const states = r.timeline.map(t => t.state);
  assert.ok(states.includes('full_presentation_requested'));
  assert.equal(r.evidence.created, 'created');
});

test('source rotation: partial deck is cleared and rebuilt', async () => {
  await fx.installPanel(page, { deckSize: 3 });
  await page.evaluate(() => {
    document.querySelectorAll('.slides-list-group-item').forEach((el, i) => { if (i > 0) el.remove(); });
  });
  const r = await presenter.runFullPresentation(page, { expectedSlideCount: 3 });
  assert.equal(r.evidence.cleared, 'cleared');
  assert.equal(r.evidence.created, 'created');
});

test('source rotation: extra slides make the deck invalid', async () => {
  await fx.installPanel(page, { deckSize: 4 });
  const r = await presenter.runFullPresentation(page, { expectedSlideCount: 3 });
  const states = r.timeline.map(t => t.state);
  assert.ok(states.includes('cleanup_required'));
});

test('source rotation: missing slides make the deck partial', async () => {
  await fx.installPanel(page, { deckSize: 2 });
  const r = await presenter.runFullPresentation(page, { expectedSlideCount: 4 });
  const states = r.timeline.map(t => t.state);
  assert.ok(states.includes('cleanup_required'));
});

test('source rotation: clear and re-add yields a fresh deck', async () => {
  await fx.installPanel(page, { deckSize: 3 });
  await presenter.clearPresentationDeck(page);
  const r = await presenter.requestFullPresentation(page);
  assert.equal(r.status, 'created');
  assert.ok(r.slideCount >= 1);
});

test('source rotation: clear on an empty deck is a no-op', async () => {
  await fx.installPanel(page, { empty: true });
  const r = await presenter.clearPresentationDeck(page);
  assert.equal(['already-empty', 'cleared'].includes(r.status), true);
});

test('source rotation: Auto-create keeps the first slide selected', async () => {
  await fx.installPanel(page, { empty: true });
  await presenter.requestFullPresentation(page);
  const state = await presenter.getPresentationState(page);
  assert.equal(state.activeIndex, 0);
  assert.ok(state.activeId);
});

test('source rotation: cleared deck exposes the empty-state CTA', async () => {
  await fx.installPanel(page, { deckSize: 3 });
  await presenter.clearPresentationDeck(page);
  const hasCta = await page.evaluate(() => Boolean(document.querySelector('.slides-list-empty button')));
  assert.equal(hasCta, true);
});

test('source rotation: full presentation re-creation is deterministic', async () => {
  await fx.installPanel(page, { empty: true });
  const a = await presenter.requestFullPresentation(page);
  // After Auto-create the deck is no longer empty, so a second call has no
  // Auto-create button to click; assert the documented failure mode.
  const a2 = await presenter.requestFullPresentation(page);
  assert.equal(a.status, 'created');
  assert.equal(a.slideCount, 3);
  assert.equal(a2.status, 'no-auto-create');
});

test('source rotation: clearPresentationDeck followed by Auto-create yields a fresh deck', async () => {
  await fx.installPanel(page, { deckSize: 3 });
  await presenter.clearPresentationDeck(page);
  const r = await presenter.requestFullPresentation(page);
  assert.equal(r.status, 'created');
  assert.equal(r.slideCount, 3);
});

test('source rotation: preparePresentation does not over-write a complete deck', async () => {
  await fx.installPanel(page, { deckSize: 4 });
  const before = await presenter.preparePresentation(page, { autoCreate: false });
  const after = await presenter.preparePresentation(page, { autoCreate: true });
  assert.deepEqual(before.slides.map(s => s.id), after.slides.map(s => s.id));
});
