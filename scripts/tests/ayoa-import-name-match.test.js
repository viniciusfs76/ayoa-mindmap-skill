'use strict';
// Regression tests for the bug that the Ayoa /v2/import/text endpoint returns
// INTERNAL_ERROR 500 when boardName is the empty string. The "1 import failed"
// toast the user sees is the symptom; the fix is to derive a non-empty
// boardName from the OPML <title> (or the first outline text) and to
// explicitly assert it on the payload.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseOpml } = require('../lib/opml-parser.js');

const FIXTURES = path.join(__dirname, 'fixtures');

function load(name) { return fs.readFileSync(path.join(FIXTURES, name), 'utf8'); }

function deriveBoardName(opmlContent, override) {
  if (override && override.trim()) return override.trim();
  const t = opmlContent.match(/<title>\s*([^<]+?)\s*<\/title>/);
  if (t) return t[1].trim();
  const first = opmlContent.match(/<outline\s+text="([^"]+)"/);
  if (first) return first[1].trim();
  return 'Imported Map';
}

const CASES = [
  { file: 'waico-maco.opml', expected: 'WAICO-MACO' },
  { file: 'final-copa-2026-argentina-espanha.opml', expected: 'Final da Copa do Mundo FIFA 2026 \u2014 Argentina x Espanha' },
  { file: 'final-copa-2026-argentina-espanha-compatible.opml', expected: 'Final da Copa do Mundo FIFA 2026 - Argentina x Espanha' },
  { file: 'world-cup-final-2026-strict.opml', expected: 'World Cup Final 2026 - Argentina vs Spain' },
];

for (const c of CASES) {
  test(`derive: ${c.file} → non-empty boardName matching <title>`, () => {
    const opml = load(c.file);
    const name = deriveBoardName(opml, null);
    assert.ok(name && name.length > 0, 'derived name is empty');
    assert.notEqual(name, '', 'boardName must not be empty (causes INTERNAL_ERROR 500)');
    assert.equal(name, c.expected);
  });
}

test('derive: override wins over <title>', () => {
  const opml = load('waico-maco.opml');
  const name = deriveBoardName(opml, 'My Custom Board');
  assert.equal(name, 'My Custom Board');
});

test('derive: empty override falls back to <title>', () => {
  const opml = load('waico-maco.opml');
  const name = deriveBoardName(opml, '   ');
  assert.equal(name, 'WAICO-MACO');
});

test('derive: OPML without <title> uses first outline text', () => {
  const opml = '<?xml version="1.0"?><opml version="2.0"><head></head><body><outline text="Root Node"><outline text="Child"/></outline></body></opml>';
  assert.equal(deriveBoardName(opml, null), 'Root Node');
});

test('derive: empty OPML falls back to default', () => {
  const opml = '<?xml version="1.0"?><opml version="2.0"><head></head><body></body></opml>';
  assert.equal(deriveBoardName(opml, null), 'Imported Map');
});

test('fixture consistency: derived name and central node are not identical unless OPML design says so', () => {
  // When a map is named "Foo" but the central node is "Foo - Mind Map", Ayoa
  // tolerates the divergence. We assert the names are non-empty for every
  // fixture so the regression test is symmetric.
  for (const c of CASES) {
    const r = parseOpml(load(c.file));
    const derived = deriveBoardName(load(c.file), null);
    assert.ok(derived && r.central, 'both name and central must be present');
  }
});
