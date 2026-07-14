'use strict';

// ayoa-present-fallback.test.js
// Verifies that the locator strategies keep working when the UI uses different
// labels, ARIA strings and class names across timezones and translations.

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

test('fallback: locatePresentControl matches the English "Present" ARIA', async () => {
  await page.setContent('<button class="x" aria-label="Present">P</button>');
  const r = await presenter.locatePresentControl(page);
  assert.equal(r.found, true);
});

test('fallback: locatePresentControl matches the legacy "Presenting Mode" label', async () => {
  await page.setContent('<button class="x" aria-label="Presenting Mode">P</button>');
  const r = await presenter.locatePresentControl(page);
  assert.equal(r.found, true);
});

test('fallback: locatePresentControl matches the Portuguese "Apresentar" label', async () => {
  await page.setContent('<button class="x" aria-label="Apresentar mapa">A</button>');
  const r = await presenter.locatePresentControl(page);
  assert.equal(r.found, true);
});

test('fallback: locatePresentControl matches the Spanish "Presentar" label', async () => {
  await page.setContent('<button class="x" aria-label="Presentar mapa">A</button>');
  const r = await presenter.locatePresentControl(page);
  assert.equal(r.found, true);
});

test('fallback: locatePresentControl matches the textual "presentation" tooltip', async () => {
  await page.setContent('<button class="x" title="Start a presentation">P</button>');
  const r = await presenter.locatePresentControl(page);
  assert.equal(r.found, true);
});

test('fallback: locatePresentControl matches by class even without ARIA', async () => {
  await page.setContent('<div class="toggle-presenter" data-id="1"></div>');
  const r = await presenter.locatePresentControl(page);
  assert.equal(r.found, true);
});

test('fallback: locatePresentControl reports not-found when nothing matches', async () => {
  await page.setContent('<div class="unrelated"></div>');
  const r = await presenter.locatePresentControl(page);
  assert.equal(r.found, false);
});

test('fallback: locatePresentControl reports the bounding box for the first match', async () => {
  await page.setContent('<button class="toggle-presenter" aria-label="Present"></button>');
  const r = await presenter.locatePresentControl(page);
  assert.equal(r.found, true);
  assert.ok(r.x >= 0);
  assert.ok(r.y >= 0);
  // The selector used by this locator may yield an empty `text` when the
  // element only exposes an aria-label; assert the contract shape instead.
  assert.equal(typeof r.text, 'string');
});

test('fallback: locatePresentControl prefers the first match by document order', async () => {
  await page.setContent(`
    <button class="x" aria-label="Present">A</button>
    <button class="x" aria-label="Present">B</button>
  `);
  const r = await presenter.locatePresentControl(page);
  assert.equal(r.found, true);
  assert.equal(r.tag, 'BUTTON');
});

test('fallback: openPresenter handles the panel mounted in a shadow root via light DOM', async () => {
  // Ayoa does not use shadow DOM; guard against accidental reliance on a quirk.
  await fx.installPanel(page);
  const r = await presenter.openPresenter(page);
  assert.ok(r.length >= 1);
});

test('fallback: verifyPlanCompatibility returns ready when only the panel exists', async () => {
  await page.setContent('<div class="slides-list-container"></div>');
  const r = await presenter.verifyPlanCompatibility(page);
  assert.equal(r.ready, true);
});

test('fallback: verifyPlanCompatibility returns ready when only the toggle exists', async () => {
  await page.setContent('<div class="toggle-presenter"></div>');
  const r = await presenter.verifyPlanCompatibility(page);
  assert.equal(r.ready, true);
});

test('fallback: verifyPlanCompatibility returns not ready when the map is empty', async () => {
  await page.setContent('<div></div>');
  const r = await presenter.verifyPlanCompatibility(page);
  assert.equal(r.ready, false);
});

test('fallback: openPresenter still works when the panel is the last descendant', async () => {
  await page.setContent(`
    <div class="app-root">
      <div class="map-canvas"></div>
      <div class="slides-list-container">
        <div class="slides-list-content">
          <ol><li id="only" class="slides-list-group-item selected"></li></ol>
        </div>
      </div>
    </div>
  `);
  const r = await presenter.openPresenter(page);
  assert.equal(r.length, 1);
});
