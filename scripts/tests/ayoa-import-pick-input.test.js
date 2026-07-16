'use strict';
// Deterministic Puppeteer-style test: drives the same pickBoardNameInput
// predicate that import-opml.js uses inside Chromium, against a synthetic
// representation of the Ayoa "Novo projeto" modal. The test mirrors what
// Array.from(document.querySelectorAll('input[type=text], input:not([type])'))
// .filter(x => x.offsetParent !== null) yields in the real Ayoa DOM.
//
// Running this in npm test is fast (<50ms) and covers the regression that
// "1 import failed" was caused by typing the boardName into the
// "Pesquisar projetos" search bar instead of the modal's title input.

const test = require('node:test');
const assert = require('node:assert/strict');
const { pickBoardNameInput } = require('../import-opml.js');

const VISIBLE = { offsetParent: {}, parentNode: {} };

function input(placeholder, ariaLabel = '') { return { placeholder, ariaLabel, ...VISIBLE }; }

const AYO_A_DASHBOARD = [
  input('Pesquisar projetos', 'Search projects'),     // wrong: search bar
  input('Digite o nome do seu projeto', ''),         // right: modal title
];

test('pickBoardNameInput: returns the modal title, not the search bar', () => {
  const pick = pickBoardNameInput(AYO_A_DASHBOARD);
  assert.equal(pick.placeholder, 'Digite o nome do seu projeto');
});

test('pickBoardNameInput: tolerates aria-label only matches (e.g. Project name)', () => {
  const pick = pickBoardNameInput([
    input('Search…', 'Search projects'),
    input('', 'Project name'),
  ]);
  assert.equal(pick.ariaLabel, 'Project name');
});

test('pickBoardNameInput: tolerates accented "T\u00edtulo"', () => {
  const pick = pickBoardNameInput([input('Search…'), input('', 'T\u00edtulo')]);
  assert.equal(pick.ariaLabel, 'T\u00edtulo');
});

test('pickBoardNameInput: hidden inputs are skipped', () => {
  const pick = pickBoardNameInput([
    { placeholder: 'Digite o nome do seu projeto', ariaLabel: '', offsetParent: null },
    input('Pesquisar projetos'),
  ]);
  assert.equal(pick.placeholder, 'Pesquisar projetos');
});

test('pickBoardNameInput: returns null when no visible inputs', () => {
  assert.equal(pickBoardNameInput([]), null);
  assert.equal(pickBoardNameInput(null), null);
});

test('pickBoardNameInput: falls back to first visible when no marker matches', () => {
  const pick = pickBoardNameInput([input('Random 1'), input('Random 2')]);
  assert.equal(pick.placeholder, 'Random 1');
});

test('pickBoardNameInput: matches "New map" / "Novo mapa"', () => {
  assert.equal(pickBoardNameInput([input('New map')]).placeholder, 'New map');
  assert.equal(pickBoardNameInput([input('Novo mapa')]).placeholder, 'Novo mapa');
});

test('pickBoardNameInput: matches "Board name"', () => {
  assert.equal(pickBoardNameInput([input('Board name')]).placeholder, 'Board name');
});

test('pickBoardNameInput: skips hidden search bar even when present', () => {
  const pick = pickBoardNameInput([
    { placeholder: 'Pesquisar projetos', ariaLabel: '', offsetParent: null },
    input('Digite o nome do seu projeto'),
  ]);
  assert.equal(pick.placeholder, 'Digite o nome do seu projeto');
});
