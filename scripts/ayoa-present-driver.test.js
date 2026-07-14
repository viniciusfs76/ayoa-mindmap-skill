'use strict';

// ayoa-present-driver.test.js
// Contract tests for the runFullPresentation driver: same input always
// produces the same shape of output, regardless of internal sequencing.

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

test('driver: returns the documented keys', async () => {
  await fx.installPanel(page);
  const r = await presenter.runFullPresentation(page);
  for (const key of ['state', 'history', 'evidence', 'unexpected', 'timeline', 'visited', 'finalState']) {
    assert.ok(key in r, `driver must return ${key}`);
  }
});

test('driver: timeline is a non-empty array', async () => {
  await fx.installPanel(page);
  const r = await presenter.runFullPresentation(page);
  assert.ok(Array.isArray(r.timeline));
  assert.ok(r.timeline.length > 0);
});

test('driver: history is an array of {from, to, at, note}', async () => {
  await fx.installPanel(page);
  const r = await presenter.runFullPresentation(page);
  for (const entry of r.history) {
    for (const k of ['from', 'to', 'at', 'note']) {
      assert.ok(k in entry, `history entry must have ${k}`);
    }
  }
});

test('driver: evidence accumulates without losing previous keys', async () => {
  await fx.installPanel(page);
  const r = await presenter.runFullPresentation(page);
  for (const k of ['plan_ready', 'present_control', 'openedSlides', 'classification', 'slideCount', 'lastVisited', 'stopped']) {
    assert.ok(k in r.evidence, `evidence must include ${k}`);
  }
});

test('driver: unexpected is an array of strings', async () => {
  await fx.installPanel(page);
  const r = await presenter.runFullPresentation(page);
  assert.ok(Array.isArray(r.unexpected));
  for (const u of r.unexpected) assert.equal(typeof u, 'string');
});

test('driver: visited array mirrors step_change_confirmed events', async () => {
  await fx.installPanel(page);
  const r = await presenter.runFullPresentation(page);
  const confirmed = r.timeline.filter(t => t.state === 'step_change_confirmed').length;
  assert.equal(r.visited.length, confirmed);
});

test('driver: terminal state is one of presentation_completed or blocked', async () => {
  await fx.installPanel(page);
  const r = await presenter.runFullPresentation(page);
  assert.ok(['presentation_completed', 'blocked'].includes(r.state));
});

test('driver: finalState.presenting is false on success', async () => {
  await fx.installPanel(page);
  const r = await presenter.runFullPresentation(page);
  assert.equal(r.state, 'presentation_completed');
  assert.equal(r.finalState.presenting, false);
});

test('driver: presentation_completed is the final state on success', async () => {
  await fx.installPanel(page);
  const r = await presenter.runFullPresentation(page);
  const lastEvent = r.timeline[r.timeline.length - 1];
  assert.equal(lastEvent.state, 'presentation_completed');
});

test('driver: onBlocked is the terminal state with a reason', async () => {
  await page.setContent('<div id="app-content"></div>');
  const r = await presenter.runFullPresentation(page);
  assert.equal(r.state, 'blocked');
  const lastEvent = r.timeline[r.timeline.length - 1];
  assert.equal(lastEvent.state, 'blocked');
  assert.ok(lastEvent.detail.reason);
});

test('driver: runFullPresentation is deterministic on a stable fixture', async () => {
  const pageA = await browser.newPage();
  const pageB = await browser.newPage();
  try {
    await fx.installPanel(pageA);
    const a = await presenter.runFullPresentation(pageA);
    await fx.installPanel(pageB);
    const b = await presenter.runFullPresentation(pageB);
    assert.equal(a.state, b.state);
    assert.equal(a.evidence.classification, b.evidence.classification);
    assert.equal(a.evidence.slideCount, b.evidence.slideCount);
  } finally {
    await pageA.close();
    await pageB.close();
  }
});

test('driver: evidence.slideCount equals finalState.slideCount on success', async () => {
  await fx.installPanel(page, { deckSize: 4 });
  const r = await presenter.runFullPresentation(page);
  assert.equal(r.evidence.slideCount, r.finalState.slideCount);
});
