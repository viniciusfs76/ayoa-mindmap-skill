'use strict';

// ayoa-present-aria.test.js
// Ayoa's panel exposes accessible names; this file pins the ARIA contract so a
// redesign that loses accessible names is caught.

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

test('aria: previous and next buttons have accessible names', async () => {
  await fx.installPanel(page);
  const names = await page.evaluate(() => ({
    prev: document.querySelector('.slides-nav-container > :first-child')?.getAttribute('aria-label'),
    next: document.querySelector('.slides-nav-container > :last-child')?.getAttribute('aria-label'),
  }));
  assert.equal(names.prev, 'Previous slide');
  assert.equal(names.next, 'Next slide');
});

test('aria: a disabled next control surfaces aria-disabled when available', async () => {
  await fx.installPanel(page, { deckSize: 1 });
  const next = await presenter.getNextControl(page);
  assert.equal(next.found, true);
  assert.equal(next.enabled, false);
});

test('aria: a non-disabled next control is reported as enabled', async () => {
  await fx.installPanel(page, { deckSize: 3 });
  const next = await presenter.getNextControl(page);
  assert.equal(next.enabled, true);
});

test('aria: previous and previous mirror the same contract', async () => {
  await fx.installPanel(page, { deckSize: 3 });
  const prev = await presenter.getPreviousControl(page);
  assert.equal(prev.found, true);
  assert.equal(prev.enabled, false);

  await presenter.startPresentation(page);
  await presenter.navigatePresentation(page, 'next');
  const prev2 = await presenter.getPreviousControl(page);
  assert.equal(prev2.enabled, true);
});

test('aria: missing previous button is reported as not found', async () => {
  await page.setContent('<div class="slides-list-container"></div>');
  const prev = await presenter.getPreviousControl(page);
  assert.equal(prev.found, false);
});

test('aria: missing next button is reported as not found', async () => {
  await page.setContent('<div class="slides-list-container"></div>');
  const next = await presenter.getNextControl(page);
  assert.equal(next.found, false);
});

test('aria: the present control reports its bounding box for keyboard/screen reader users', async () => {
  await fx.installPanel(page);
  const r = await presenter.locatePresentControl(page);
  assert.equal(r.found, true);
  assert.ok(r.x >= 0);
  assert.ok(r.y >= 0);
});

test('aria: getNextControl exposes the visible label for debugging', async () => {
  await fx.installPanel(page);
  const next = await presenter.getNextControl(page);
  assert.ok('text' in next);
});

test('aria: a control that becomes disabled mid-run is observable', async () => {
  await fx.installPanel(page, { deckSize: 1 });
  await presenter.startPresentation(page);
  const next = await presenter.getNextControl(page);
  assert.equal(next.enabled, false);
});
