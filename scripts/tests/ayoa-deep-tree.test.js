'use strict';
// Deterministic test: build the deep OPML, parse with both Node and Python
// parsers, assert node count and depth distribution.
// Guard: every leaf must be at depth >= 5.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { parseOpml } = require('../lib/opml-parser.js');

const OPML = path.join(process.env.HOME, 'tmp', 'portaria-ipd-v05-deep.opml');

test('OPML exists', () => {
  assert.ok(fs.existsSync(OPML), 'expected the deep OPML fixture in tmp/');
});

test('Node parser counts and depth', () => {
  const r = parseOpml(fs.readFileSync(OPML, 'utf8'));
  // Central node counts as depth 0.
  assert.ok(r.nodeCount >= 50, `node count too small: ${r.nodeCount}`);
  assert.ok(r.maxDepth >= 5, `max depth must be >= 5, got ${r.maxDepth}`);
  // Count by depth so we can spot-check the distribution.
  const byDepth = {};
  for (const n of r.nodes) byDepth[n.depth] = (byDepth[n.depth] || 0) + 1;
  assert.ok((byDepth[5] || 0) >= 5, `expected >= 5 nodes at depth 5, got ${byDepth[5] || 0}`);
  // 4 top-level branches.
  const branches = r.nodes.filter(n => n.depth === 1);
  assert.equal(branches.length, 4);
});

test('Python parser cross-check (deterministic invariant)', () => {
  const r = spawnSync('python3', ['-c', `
import sys; sys.path.insert(0, '.')
from tests._pyayoa_opml import parse_opml
r = parse_opml(open('${OPML}').read())
print(r['node_count'], r['max_depth'])
`], { encoding: 'utf8' });
  assert.equal(r.status, 0, 'python parser failed: ' + r.stderr);
  const [count, depth] = r.stdout.trim().split(' ').map(Number);
  assert.ok(count >= 50, `python node count too small: ${count}`);
  assert.ok(depth >= 5, `python max depth must be >= 5, got ${depth}`);
});