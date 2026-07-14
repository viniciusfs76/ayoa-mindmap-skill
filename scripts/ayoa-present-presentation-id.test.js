'use strict';

// ayoa-present-presentation-id.test.js
// Confirms the unique-id contract for the slide list: every slide has a stable
// id, ids are unique, reordering keeps the same set of ids, and clear
// removes every id without leaving orphans.

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

test('ids: every slide has a unique id', async () => {
  await fx.installPanel(page, { deckSize: 5 });
  const ids = await page.evaluate(() => [...document.querySelectorAll('.slides-list-group-item')].map(el => el.id));
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length);
});

test('ids: getSlideList returns one entry per slide', async () => {
  await fx.installPanel(page, { deckSize: 5 });
  const slides = await presenter.getSlideList(page);
  assert.equal(slides.length, 5);
});

test('ids: clearPresentationDeck removes every id', async () => {
  await fx.installPanel(page, { deckSize: 4 });
  await presenter.clearPresentationDeck(page);
  const ids = await page.evaluate(() => [...document.querySelectorAll('.slides-list-group-item')].map(el => el.id));
  assert.deepEqual(ids, []);
});

test('ids: requestFullPresentation after clear produces a fresh set of ids', async () => {
  await fx.installPanel(page, { deckSize: 3 });
  const before = (await presenter.getSlideList(page)).map(s => s.id);
  await presenter.clearPresentationDeck(page);
  const after = await presenter.requestFullPresentation(page);
  assert.ok(after.slideCount >= 1);
  const newIds = (await presenter.getSlideList(page)).map(s => s.id);
  for (const id of newIds) {
    assert.equal(before.includes(id), false, `id ${id} should not be reused from the previous deck`);
  }
});

test('ids: reordering the slides via drag keeps the same set of ids', async () => {
  await fx.installPanel(page, { deckSize: 3 });
  const before = (await presenter.getSlideList(page)).map(s => s.id);
  await page.evaluate(() => {
    const list = document.querySelector('.slides-list-content ol');
    const items = [...list.children];
    // Move the first item to position 1, producing [slide-2, slide-1, slide-3].
    list.insertBefore(items[0], items[2]);
  });
  const after = (await presenter.getSlideList(page)).map(s => s.id);
  assert.deepEqual(after, ['slide-2', 'slide-1', 'slide-3']);
  assert.deepEqual([...after].sort(), [...before].sort());
});

test('ids: preparePresentation returns the ordered id list', async () => {
  await fx.installPanel(page, { deckSize: 3 });
  const r = await presenter.preparePresentation(page, { autoCreate: false });
  assert.deepEqual(r.slides.map(s => s.id), ['slide-1', 'slide-2', 'slide-3']);
});

test('ids: selectFirstItem returns the first id in the list', async () => {
  await fx.installPanel(page, { deckSize: 3 });
  const r = await presenter.selectFirstItem(page);
  assert.equal(r.firstId, 'slide-1');
});

test('ids: a custom id scheme (auto-1) is also accepted by selectFirstItem', async () => {
  await fx.installPanel(page, { empty: true });
  await presenter.requestFullPresentation(page);
  const r = await presenter.selectFirstItem(page);
  assert.equal(r.firstId, 'auto-1');
});

test('ids: re-running runFullPresentation with the same deck yields the same ids', async () => {
  await fx.installPanel(page);
  await presenter.runFullPresentation(page);
  const ids1 = (await presenter.getSlideList(page)).map(s => s.id);
  await presenter.runFullPresentation(page);
  const ids2 = (await presenter.getSlideList(page)).map(s => s.id);
  assert.deepEqual(ids1, ids2);
});

test('ids: the helper getSlideList does not throw when the panel is empty', async () => {
  await fx.installPanel(page, { empty: true });
  const slides = await presenter.getSlideList(page);
  assert.deepEqual(slides, []);
});
