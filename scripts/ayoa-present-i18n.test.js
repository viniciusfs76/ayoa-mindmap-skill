'use strict';

// ayoa-present-i18n.test.js
// Confirms that the skill accepts the Ayoa Web labels in their main languages
// (EN/PT-BR/ES). All three call the same code paths, so the underlying DOM
// helpers should be label-agnostic.

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

const EN = { add: 'Add', autoCreate: 'Auto-create', clearAll: 'Clear all' };
const PT = { add: 'Adicionar', autoCreate: 'Criar automaticamente', clearAll: 'Limpar tudo' };
const ES = { add: 'Añadir', autoCreate: 'Crear automáticamente', clearAll: 'Borrar todo' };

test('i18n: English labels are accepted by autoCreatePresentation', async () => {
  await fx.installPanel(page, { empty: true, labels: EN });
  const ok = await presenter.autoCreatePresentation(page);
  assert.equal(ok, true);
});

test('i18n: Portuguese labels are accepted by autoCreatePresentation', async () => {
  await fx.installPanel(page, { empty: true, labels: PT });
  const ok = await presenter.autoCreatePresentation(page);
  assert.equal(ok, true);
});

test('i18n: Spanish labels are accepted by autoCreatePresentation', async () => {
  await fx.installPanel(page, { empty: true, labels: ES });
  const ok = await presenter.autoCreatePresentation(page);
  assert.equal(ok, true);
});

test('i18n: English Clear all removes the deck', async () => {
  await fx.installPanel(page, { deckSize: 3, labels: EN });
  const r = await presenter.clearPresentationDeck(page);
  assert.equal(r.status, 'cleared');
});

test('i18n: Portuguese Limpar tudo removes the deck', async () => {
  await fx.installPanel(page, { deckSize: 3, labels: PT });
  const r = await presenter.clearPresentationDeck(page);
  assert.equal(r.status, 'cleared');
});

test('i18n: Spanish Borrar todo removes the deck', async () => {
  await fx.installPanel(page, { deckSize: 3, labels: ES });
  const r = await presenter.clearPresentationDeck(page);
  assert.equal(r.status, 'cleared');
});

test('i18n: full run works with Portuguese labels', async () => {
  await fx.installPanel(page, { empty: true, labels: PT });
  const r = await presenter.runFullPresentation(page, { expectedSlideCount: 3 });
  assert.equal(r.state, 'presentation_completed');
});

test('i18n: full run works with English labels', async () => {
  await fx.installPanel(page, { empty: true, labels: EN });
  const r = await presenter.runFullPresentation(page, { expectedSlideCount: 3 });
  assert.equal(r.state, 'presentation_completed');
});

test('i18n: full run works with Spanish labels', async () => {
  await fx.installPanel(page, { empty: true, labels: ES });
  const r = await presenter.runFullPresentation(page, { expectedSlideCount: 3 });
  assert.equal(r.state, 'presentation_completed');
});

test('i18n: case-insensitive English "CLEAR ALL" works', async () => {
  await fx.installPanel(page, { deckSize: 2 });
  // Manually inject an uppercase portal to validate case insensitivity.
  await page.evaluate(() => {
    const panel = document.querySelector('.slides-list-container');
    const portal = document.createElement('div');
    portal.className = 'slides-popper-content';
    const clear = document.createElement('div');
    clear.className = 'slides-more-item';
    clear.innerText = 'CLEAR ALL';
    clear.addEventListener('click', () => {
      panel.querySelectorAll('.slides-list-group-item').forEach(el => el.remove());
      portal.remove();
    });
    portal.appendChild(clear);
    document.body.appendChild(portal);
  });
  const r = await presenter.clearPresentationDeck(page);
  assert.equal(['cleared', 'already-empty'].includes(r.status), true);
});
