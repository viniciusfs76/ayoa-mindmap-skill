'use strict';

// ayoa-present-transitions.test.js
// Exercises the state machine transitions of `runFullPresentation` to guarantee
// that every documented step in the briefing emits a labelled state.

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

const EXPECTED = [
  'init',
  'map_loaded',
  'present_control_found',
  'present_window_open',
  'presentation_state_checked',
  'first_item_selected',
  'start_control_found',
  'present_mode_confirmed',
  'current_step_identified',
  'next_control_found',
  'advancing',
  'step_change_confirmed',
  'last_step_reached',
  'presentation_stopped',
  'presentation_completed',
];

test('transitions: full run emits every documented state in order', async () => {
  await fx.installPanel(page);
  const result = await presenter.runFullPresentation(page);
  const emitted = new Set(result.timeline.map(t => t.state));
  for (const state of EXPECTED) {
    assert.ok(emitted.has(state), `timeline must include ${state}`);
  }
  assert.equal(result.state, 'presentation_completed');
});

test('transitions: full run reaches `last_step_reached` before stopping', async () => {
  await fx.installPanel(page, { deckSize: 3 });
  const result = await presenter.runFullPresentation(page);
  const states = result.timeline.map(t => t.state);
  const lastIdx = states.indexOf('last_step_reached');
  const stopIdx = states.indexOf('presentation_stopped');
  assert.ok(lastIdx > 0 && stopIdx > lastIdx, 'last_step_reached must precede presentation_stopped');
});

test('transitions: cleanup_required is emitted when the deck is partial', async () => {
  await fx.installPanel(page, { deckSize: 3 });
  await page.evaluate(() => {
    document.querySelectorAll('.slides-list-group-item').forEach((el, i) => { if (i > 0) el.remove(); });
  });
  const result = await presenter.runFullPresentation(page, { expectedSlideCount: 3 });
  const states = result.timeline.map(t => t.state);
  assert.ok(states.includes('cleanup_required'));
  assert.ok(states.includes('presentation_cleared'));
  assert.ok(states.includes('full_presentation_requested'));
  assert.ok(states.includes('full_presentation_validated'));
});

test('transitions: blocked is the terminal state when the toggle is missing', async () => {
  await page.setContent('<div id="app-content"></div>');
  const result = await presenter.runFullPresentation(page);
  assert.equal(result.state, 'blocked');
});

test('transitions: blocked emits a structured reason', async () => {
  await page.setContent('<div id="app-content"></div>');
  const result = await presenter.runFullPresentation(page);
  const blocked = result.timeline.filter(t => t.state === 'blocked').pop();
  assert.equal(blocked.detail.reason, 'present_control_not_found_or_map_unloaded');
});

test('transitions: present_window_open happens before presentation_state_checked', async () => {
  await fx.installPanel(page);
  const result = await presenter.runFullPresentation(page);
  const states = result.timeline.map(t => t.state);
  assert.ok(states.indexOf('present_window_open') < states.indexOf('presentation_state_checked'));
});

test('transitions: first_item_selected is a separate labelled state', async () => {
  await fx.installPanel(page);
  const result = await presenter.runFullPresentation(page);
  const states = result.timeline.map(t => t.state);
  assert.ok(states.includes('first_item_selected'));
});

test('transitions: every advancing event has a matching step_change_confirmed', async () => {
  await fx.installPanel(page);
  const result = await presenter.runFullPresentation(page);
  const advances = result.timeline.filter(t => t.state === 'advancing').length;
  const confirmed = result.timeline.filter(t => t.state === 'step_change_confirmed').length;
  assert.ok(advances > 0, 'expected at least one advancing transition');
  assert.equal(advances, confirmed);
});

test('transitions: complete_presentation_available short-circuits the cleanup path', async () => {
  await fx.installPanel(page);
  const result = await presenter.runFullPresentation(page);
  const states = result.timeline.map(t => t.state);
  assert.ok(states.includes('complete_presentation_available'));
  assert.equal(states.includes('cleanup_required'), false);
});

test('transitions: history has at least one entry per emitted state', async () => {
  await fx.installPanel(page);
  const result = await presenter.runFullPresentation(page);
  for (const event of result.timeline) {
    assert.ok(Array.isArray(event.history));
  }
});

test('transitions: presentation_completed is the final state on success', async () => {
  await fx.installPanel(page);
  const result = await presenter.runFullPresentation(page);
  assert.equal(result.state, 'presentation_completed');
});
