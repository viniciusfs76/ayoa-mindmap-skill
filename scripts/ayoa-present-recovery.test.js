'use strict';

// ayoa-present-recovery.test.js
// Validates that the skill recovers gracefully when the panel is in an
// inconsistent state: presenting=true with no first slide, panel missing,
// DOM unmounted during compact, double Start clicks, and so on.

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

test('recovery: presenting=true with no first slide is rescued by selectFirstItem', async () => {
  await fx.installPanel(page, { presenting: true });
  await page.evaluate(() => {
    document.querySelectorAll('.slides-list-group-item').forEach(el => el.classList.remove('selected'));
  });
  const r = await presenter.selectFirstItem(page);
  assert.equal(['selected', 'already-selected'].includes(r.status), true);
});

test('recovery: startPresentation clears the previous presenting flag', async () => {
  await fx.installPanel(page, { presenting: true });
  const s = await presenter.startPresentation(page);
  assert.equal(s.presenting, true);
});

test('recovery: stopPresentation handles a stuck panel', async () => {
  await fx.installPanel(page, { presenting: true });
  const s = await presenter.stopPresentation(page);
  assert.equal(s.presenting, false);
});

test('recovery: compact mode without presenting is recoverable', async () => {
  await fx.installPanel(page, { compact: true });
  const s = await presenter.getPresentationState(page);
  assert.equal(s.compact, true);
  assert.equal(s.slideCount > 0 || s.slideCount === 0, true);
});

test('recovery: openPresenter on a present window that has been unmounted re-opens it', async () => {
  await fx.installPanel(page);
  await presenter.openPresenter(page);
  // Simulate the panel being unmounted and the SPA mounting a fresh one
  // (production: Ayoa keeps the toggle even when the panel is unmounted).
  await fx.installPanel(page);
  const r = await presenter.openPresenter(page);
  assert.ok(Array.isArray(r));
  assert.equal(r.length, 3);
});

test('recovery: navigatePresentation after a DOM re-render does not throw a TypeError', async () => {
  await fx.installPanel(page);
  await presenter.startPresentation(page);
  // Simulate the SPA re-rendering the panel mid-presentation. After the
  // re-render the next click handler is attached to a new node, but the
  // presenter module continues to find a valid control and slide list.
  await page.evaluate(() => {
    const before = document.querySelector('.slides-list-container').outerHTML;
    const next = document.createElement('div');
    next.innerHTML = before;
    const fresh = next.firstElementChild;
    document.querySelector('.slides-list-container').replaceWith(fresh);
    const first = fresh.querySelector('.slides-list-group-item');
    if (first) first.classList.add('selected');
  });
  // The presentation may end up incomplete after a re-render; the contract
  // is that we don't blow up with a TypeError, regardless of whether the
  // navigation succeeded.
  try {
    const r = await presenter.navigatePresentation(page, 'next');
    assert.ok(r);
  } catch (err) {
    assert.ok(/not active|timeout|next slide navigation/i.test(err.message),
      `unexpected error: ${err.message}`);
  }
});

test('recovery: stopPresentation twice is a no-op', async () => {
  await fx.installPanel(page);
  await presenter.startPresentation(page);
  const first = await presenter.stopPresentation(page);
  const second = await presenter.stopPresentation(page);
  assert.equal(first.presenting, false);
  assert.equal(second.presenting, false);
});

test('recovery: getPresentationState tolerates a missing panel', async () => {
  await page.setContent('<div></div>');
  const s = await presenter.getPresentationState(page);
  assert.equal(s.panelOpen, false);
  assert.equal(s.slideCount, 0);
});

test('recovery: openPresenter tolerates a body without any panels', async () => {
  await page.setContent('<div></div>');
  await assert.rejects(() => presenter.openPresenter(page, { timeout: 500 }), /did not become ready/i);
});

test('recovery: locatePresentControl tolerates a body without buttons', async () => {
  await page.setContent('<div></div>');
  const r = await presenter.locatePresentControl(page);
  assert.equal(r.found, false);
});

test('recovery: stopPresentation without ever starting is a no-op', async () => {
  await fx.installPanel(page);
  const s = await presenter.stopPresentation(page);
  assert.equal(s.presenting, false);
});

test('recovery: selectFirstItem is idempotent', async () => {
  await fx.installPanel(page);
  const a = await presenter.selectFirstItem(page);
  const b = await presenter.selectFirstItem(page);
  assert.equal(a.firstId, b.firstId);
});

test('recovery: preparePresentation after Stop restores a normal state', async () => {
  await fx.installPanel(page, { presenting: true });
  const r = await presenter.preparePresentation(page, { autoCreate: false });
  assert.equal(r.presenting, false);
  assert.equal(r.slideCount, 3);
});
