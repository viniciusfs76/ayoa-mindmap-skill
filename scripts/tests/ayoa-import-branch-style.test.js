'use strict';
// Deterministic tests for --branch-style flag on import-opml.js. Validates
// the validator against VALID_BRANCH_STYLES (exported from import-opml.js)
// and asserts the body sent to /v2/import/text uses BRANCH_STYLE rather
// than the historical hardcoded 'organic_v2' literal.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { VALID_BRANCH_STYLES, parseOpml } = require('../import-opml.js');
const SCRIPT = path.join(__dirname, '..', 'import-opml.js');

test('VALID_BRANCH_STYLES is a non-empty Set of valid themeIds', () => {
  assert.ok(VALID_BRANCH_STYLES instanceof Set);
  assert.ok(VALID_BRANCH_STYLES.size >= 9, 'at least 9 documented Ayoa themeIds');
  for (const v of ['organic_v2','radial','speed','straight','curved','angled','classic']) {
    assert.ok(VALID_BRANCH_STYLES.has(v), `missing ${v}`);
  }
});

test('parseOpml smoke test still works', () => {
  // Ensures the refactor (adding VALID_BRANCH_STYLES to exports) did not
  // break the other parser exports used by the wider test surface.
  const src = '<?xml version="1.0"?><opml><head><title>T</title></head><body><outline text="r"/></body></opml>';
  const r = parseOpml(src);
  assert.equal(r.central, 'r');
  assert.equal(r.nodeCount, 1);
});

test('import-opml.js source body uses THEME_ID for themeId', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  // The body of POST /v2/import/text must reference THEME_ID, not the
  // hardcoded 'organic_v2' string that was removed when --branch-style was
  // introduced.
  assert.ok(/themeId:\s*THEME_ID\b/.test(src), 'body must reference THEME_ID');
});

test('--branch-style and --theme-id are aliases that flow through THEME_ID', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  // Both flags must be recognised and funneled into THEME_ID. A regression
  // here would mean the user passes --branch-style and it gets silently
  // ignored.
  assert.match(src, /ARGS\[['"]branch-style['"]\]\s*\|\|\s*ARGS\[['"]theme-id['"]\]\s*\|\|\s*ARGS\.themeId/);
  assert.match(src, /--branch-style/);
});