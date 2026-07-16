'use strict';

// tests/opml-parser.test.js — covers the pure OPML parser.

const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../lib/opml-parser.js');
const fs = require('node:fs');
const path = require('node:path');

const SAMPLE_OPML = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Test Map</title>
    <expansionState>0,1,2</expansionState>
  </head>
  <body>
    <outline text="CENTRAL" _color="#CC0000" _icon="★">
      <outline text="BRANCH-A" _color="#3366CC">
        <outline text="LEAF-A1" _color="#339933"/>
        <outline text="LEAF-A2" _color="#339933"/>
      </outline>
      <outline text="BRANCH-B" _color="#3366CC">
        <outline text="LEAF-B1"/>
      </outline>
    </outline>
  </body>
</opml>`;

test('parser: parseOpml returns correct node count', () => {
  const r = p.parseOpml(SAMPLE_OPML);
  assert.equal(r.nodeCount, 6);
  assert.equal(r.maxDepth, 2);
  assert.equal(r.central, 'CENTRAL');
  // title from <title> in OPML head
  assert.equal(r.title, 'Test Map');
});

test('parser: all nodes preserve text', () => {
  const r = p.parseOpml(SAMPLE_OPML);
  const texts = r.nodes.map(n => n.text);
  assert.ok(texts.includes('CENTRAL'));
  assert.ok(texts.includes('BRANCH-A'));
  assert.ok(texts.includes('LEAF-A1'));
  assert.ok(texts.includes('BRANCH-B'));
});

test('parser: all nodes preserve depth', () => {
  const r = p.parseOpml(SAMPLE_OPML);
  assert.equal(r.nodes.find(n => n.text === 'CENTRAL').depth, 0);
  assert.equal(r.nodes.find(n => n.text === 'BRANCH-A').depth, 1);
  assert.equal(r.nodes.find(n => n.text === 'LEAF-A1').depth, 2);
  assert.equal(r.nodes.find(n => n.text === 'BRANCH-B').depth, 1);
  assert.equal(r.nodes.find(n => n.text === 'LEAF-B1').depth, 2);
});

test('parser: preserves color and icon attributes', () => {
  const r = p.parseOpml(SAMPLE_OPML);
  const central = r.nodes.find(n => n.text === 'CENTRAL');
  assert.equal(central.color, '#CC0000');
  assert.equal(central.icon, '★');
  const a = r.nodes.find(n => n.text === 'BRANCH-A');
  assert.equal(a.color, '#3366CC');
  const leaf = r.nodes.find(n => n.text === 'LEAF-A1');
  assert.equal(leaf.color, '#339933');
});

test('parser: parentId is set correctly', () => {
  const r = p.parseOpml(SAMPLE_OPML);
  const central = r.nodes.find(n => n.text === 'CENTRAL');
  assert.equal(central.parentId, 0);
  assert.equal(central.id, 1);
  const leaf = r.nodes.find(n => n.text === 'LEAF-A1');
  assert.notEqual(leaf.parentId, 0);
  const parent = r.nodes.find(n => n.id === leaf.parentId);
  assert.equal(parent.text, 'BRANCH-A');
});

test('parser: expansionState is extracted', () => {
  const r = p.parseOpml(SAMPLE_OPML);
  assert.deepEqual(r.expanded, [0, 1, 2]);
});

test('parser: throws on empty input', () => {
  assert.throws(() => p.parseOpml(''), /non-empty/);
  assert.throws(() => p.parseOpml(null), /non-empty/);
});

test('parser: throws on non-OPML root', () => {
  assert.throws(() => p.parseOpml('<foo/>'), /must be/);
});

test('parser: throws on missing body', () => {
  assert.throws(() => p.parseOpml('<opml><head><title>X</title></head></opml>'), /<body> is required/);
});

test('parser: throws on unclosed tag', () => {
  assert.throws(() => p.parseOpml('<opml><body><outline text="X"></body></opml>'), /unclosed|tag mismatch/);
});

test('parser: empty outline produces no nodes', () => {
  const r = p.parseOpml(`<?xml version="1.0"?>
<opml version="2.0">
  <head><title>Empty</title></head>
  <body></body>
</opml>`);
  assert.equal(r.nodeCount, 0);
});

test('parser: deep nesting preserves all levels', () => {
  const r = p.parseOpml(`<?xml version="1.0"?>
<opml version="2.0">
  <head><title>Deep</title></head>
  <body>
    <outline text="A">
      <outline text="B">
        <outline text="C">
          <outline text="D"/>
        </outline>
      </outline>
    </outline>
  </body>
</opml>`);
  assert.equal(r.nodeCount, 4);
  assert.equal(r.maxDepth, 3);
});

test('parser: self-closing outline produces leaf node', () => {
  const r = p.parseOpml(`<?xml version="1.0"?>
<opml version="2.0">
  <head><title>Leaf</title></head>
  <body>
    <outline text="LEAF"/>
  </body>
</opml>`);
  assert.equal(r.nodeCount, 1);
  assert.equal(r.central, 'LEAF');
});

test('parser: parses OPML with only text attribute', () => {
  const r = p.parseOpml(SAMPLE_OPML);
  const leaf = r.nodes.find(n => n.text === 'LEAF-B1');
  assert.equal(leaf.color, null);
  assert.equal(leaf.icon, null);
});

test('parser: handles the actual waico-maco OPML', () => {
  const waicoPath = path.join(process.env.HOME, 'tmp', 'waico-maco.opml');
  if (!require('fs').existsSync(waicoPath)) return;
  const text = require('fs').readFileSync(waicoPath, 'utf8');
  const r = p.parseOpml(text);
  assert.equal(r.central, 'WAICO-MACO');
  assert.equal(r.nodeCount, 33);
  assert.ok(r.nodes.every(n => n.text === n.text.toUpperCase()), 'all nodes in CAIXA ALTA');
});

test('parser: _parseAttrs extracts XML attributes', () => {
  // The internal attrRe regex is now embedded inside tokenise — verify it works
  // by tokenising a tag and checking the attrs.
  const t = p.tokenise('<root a="1" b="2" c=\'3\'/>');
  assert.equal(t.length, 2); // open + close
  assert.deepEqual(t[0].attrs, { a: '1', b: '2', c: '3' });
});

test('parser: _parseXmlToObject self-closing tag', () => {
  // Verify that the buildDom handles self-closing tags correctly via tokenise+buildDom
  const t = p.tokenise('<root><leaf/></root>');
  const dom = p.buildDom(t);
  assert.equal(dom.tag, 'root');
  assert.equal(dom.children.length, 1);
  assert.equal(dom.children[0].tag, 'leaf');
  assert.equal(dom.children[0].children.length, 0);
});

test('parser: _textContent extracts text from children', () => {
  const el = { tag: 'title', attrs: {}, children: [], content: 'Hello' };
  assert.equal(p.textContent(el), 'Hello');
});

test('parser: _findChild searches correctly', () => {
  const parent = { children: [{ tag: 'head', children: [] }, { tag: 'body', children: [] }] };
  assert.ok(p.findChild(parent, 'body'));
  assert.equal(p.findChild(parent, 'footer'), null);
});
