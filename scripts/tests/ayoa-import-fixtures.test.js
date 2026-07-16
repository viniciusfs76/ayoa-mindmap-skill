'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseOpml } = require('../lib/opml-parser.js');

const FIXTURES = path.join(__dirname, 'fixtures');

function load(name) { return fs.readFileSync(path.join(FIXTURES, name), 'utf8'); }

const FIXTURE_FILES = [
  'waico-maco.opml',
  'final-copa-2026-argentina-espanha.opml',
  'final-copa-2026-argentina-espanha-compatible.opml',
  'world-cup-final-2026-strict.opml',
];

for (const file of FIXTURE_FILES) {
  test(`fixtures: ${file} parses with non-zero node count`, () => {
    const r = parseOpml(load(file));
    assert.ok(r.nodeCount > 0, `expected >0 nodes, got ${r.nodeCount}`);
    assert.ok(r.title && r.title.length > 0, 'title is empty');
    assert.ok(r.central && r.central.length > 0, 'central is empty');
    assert.ok(r.maxDepth >= 0, 'maxDepth negative');
  });
}

test('waico-maco.opml has 33 nodes (Tony Buzan validation)', () => {
  const r = parseOpml(load('waico-maco.opml'));
  assert.equal(r.nodeCount, 33);
  assert.match(r.title, /WAICO-MACO/);
  assert.equal(r.maxDepth, 2); // central + 8 sections + 24 leaves
  assert.equal(r.nodes.filter(n => n.depth === 1).length, 8);
  assert.equal(r.nodes.filter(n => n.depth === 2).length, 24);
});

test('final-copa-2026-argentina-espanha.opml central matches title', () => {
  const r = parseOpml(load('final-copa-2026-argentina-espanha.opml'));
  assert.equal(r.nodeCount, 49);
  assert.match(r.central, /Final da Copa do Mundo FIFA 2026/);
  const branches = r.nodes.filter(n => n.depth === 1).map(n => n.text);
  assert.ok(branches.includes('📅 Jogo decisivo'));
  assert.ok(branches.includes('🇦🇷 Caminho da Argentina'));
  assert.ok(branches.includes('🇪🇸 Caminho da Espanha'));
});

test('final-copa-2026-argentina-espanha-compatible.opml parses ASCII variant', () => {
  const r = parseOpml(load('final-copa-2026-argentina-espanha-compatible.opml'));
  assert.equal(r.nodeCount, 49);
  assert.match(r.central, /Final da Copa do Mundo FIFA 2026/);
});

test('world-cup-final-2026-strict.opml parses 49 nodes', () => {
  const r = parseOpml(load('world-cup-final-2026-strict.opml'));
  assert.equal(r.nodeCount, 49);
  const branches = r.nodes.filter(n => n.depth === 1).map(n => n.text);
  assert.deepEqual(branches, [
    'GAME', 'ARGENTINA PATH', 'SPAIN PATH',
    'STARS', 'TACTICS', 'NUMBERS', 'STORYLINES', 'KEY QUESTIONS',
  ]);
});
