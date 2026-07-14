'use strict';

// ayoa-present-states.test.js
// Verifies the state emitted by getPresentationState across every documented
// surface state of the Ayoa presenter panel.

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

test('states: idle panel reports presenting=false', async () => {
  await fx.installPanel(page);
  const s = await presenter.getPresentationState(page);
  assert.equal(s.presenting, false);
  assert.equal(s.compact, false);
  assert.equal(s.fullscreen, false);
});

test('states: presenting=true when the .presenting class is set', async () => {
  await fx.installPanel(page, { presenting: true });
  const s = await presenter.getPresentationState(page);
  assert.equal(s.presenting, true);
});

test('states: compact=true when the panel is collapsed', async () => {
  await fx.installPanel(page, { compact: true });
  const s = await presenter.getPresentationState(page);
  assert.equal(s.compact, true);
});

test('states: fullscreen=true when #app-content has presenter-fullscreen', async () => {
  await fx.installPanel(page, { fullscreen: true });
  const s = await presenter.getPresentationState(page);
  assert.equal(s.fullscreen, true);
});

test('states: slideCount reflects the number of slides in the panel', async () => {
  await fx.installPanel(page, { deckSize: 5 });
  const s = await presenter.getPresentationState(page);
  assert.equal(s.slideCount, 5);
});

test('states: activeIndex is -1 when no slide is selected', async () => {
  await page.setContent(`
    <div class="slides-list-container">
      <div class="slides-list-content"><ol>
        <li class="slides-list-group-item"></li>
        <li class="slides-list-group-item"></li>
      </ol></div>
    </div>`);
  const s = await presenter.getPresentationState(page);
  assert.equal(s.activeIndex, -1);
});

test('states: activeIndex is 0 when the first slide is selected', async () => {
  await fx.installPanel(page);
  const s = await presenter.getPresentationState(page);
  assert.equal(s.activeIndex, 0);
});

test('states: dualScreenAvailable mirrors the presence of .slides-popout-button', async () => {
  await fx.installPanel(page, { popout: true });
  const s = await presenter.getPresentationState(page);
  assert.equal(s.dualScreenAvailable, true);

  await fx.installPanel(page, { popout: false });
  const s2 = await presenter.getPresentationState(page);
  assert.equal(s2.dualScreenAvailable, false);
});

test('states: boundaryMarker surfaces the blue-square boundary', async () => {
  await fx.installPanel(page, { boundary: true });
  const s = await presenter.getPresentationState(page);
  assert.equal(s.boundaryMarker, true);
});

test('states: hasNextControl/hasPreviousControl follow the controls in the nav container', async () => {
  await fx.installPanel(page, { nextDisabled: false, prevDisabled: true });
  const s = await presenter.getPresentationState(page);
  assert.equal(s.hasNextControl, true);
  assert.equal(s.hasPreviousControl, true);
});

test('states: when the panel is compact, the slides cache preserves the deck', async () => {
  await fx.installPanel(page, { deckSize: 4, compact: true });
  const s = await presenter.getPresentationState(page);
  assert.equal(s.compact, true);
  assert.equal(s.slideCount, 4);
});

test('states: state_inconclusive fires when the panel is already in presenting', async () => {
  await fx.installPanel(page, { presenting: true });
  const r = await presenter.runFullPresentation(page);
  assert.equal(r.state, 'blocked');
  assert.equal(r.evidence.classification, 'state_inconclusive');
});
