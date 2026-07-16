# Ayoa Present Mode Test Patterns

This reference documents the testing patterns that emerged while building
the deterministic and Puppeteer-driven tests for the Ayoa Mindmap skill.
The patterns are split into two layers that compose cleanly.

## Layer 1 — Pure-Node deterministic tests (no browser)

For predicates that read Ayoa DOM state, write a Node test that
mirrors what the production `page.evaluate` does. The pattern uses the
shared `ayoa-present-fixtures.js` `buildPanelDom` helper to render a
realistic HTML snippet, then asserts the production predicate against it.

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPanelDom } = require('../ayoa-present-fixtures.js');

test('enterPresentationMode requires .presenting on the panel', () => {
  // The fixture starts non-presenting by default.
  const html = buildPanelDom({ deckSize: 5 });
  assert.ok(!/class="slides-list-container[^"]*presenting/.test(html),
    'fixture must start without .presenting class');
});
```

### When to use this layer

- You want to assert the *shape* of the DOM after a state transition.
- The predicate can be reduced to a string/regex over the HTML.
- The full behavior (clicks, real CSS, animation timing) is not the point.
- You want <500ms tests that run inside `npm test` on Termux without Chromium.

### When NOT to use this layer

- The bug requires actual canvas painting or animation timing.
- The bug requires the React runtime to attach event handlers.
- The bug requires a real network round-trip.

## Layer 2 — Real Puppeteer tests against Chromium headless_shell

For predicates that depend on real event dispatch, attached handlers,
or canvas rendering, run a Puppeteer test against the Termux Chromium.
The pattern is:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch (_) { puppeteer = null; }
const HAS_CHROMIUM = require('node:fs').existsSync(
  `${process.env.PREFIX || '/data/data/com.termux/files/usr'}/lib/chromium/headless_shell`
);

test('puppeteer: predicate against the real Ayoa DOM', {
  skip: !HAS_CHROMIUM || !puppeteer,
}, async () => {
  const browser = await puppeteer.launch({
    executablePath: `${process.env.PREFIX}/lib/chromium/headless_shell`,
    headless: 'shell',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process'],
    defaultViewport: { width: 1440, height: 900 },
  });
  try {
    const page = await browser.newPage();
    await page.setContent(AYO_A_FIXTURE_HTML, { waitUntil: 'domcontentloaded' });
    const out = await page.evaluate(() => ({ /* mirrors the production predicate */ }));
    assert.deepEqual(out, { /* expected */ });
  } finally {
    await browser.close();
  }
});

if (!HAS_CHROMIUM) {
  test('puppeteer: skipped (chromium not present)', { skip: true }, () => {});
}
```

### When to use this layer

- The bug is about event propagation (`dispatchEvent` vs real click).
- The bug is about Shadow DOM or `contenteditable` quirks.
- The production predicate is *only* valid when the page's React handlers
  have attached.

### Skipping

The pattern guards against two failure modes:

1. **`puppeteer-core` not installed** (e.g. CI without Node deps). The `try`
   block sets `puppeteer = null` and the test is skipped.
2. **Chromium not at `$PREFIX/lib/chromium/headless_shell`**. The skip
   predicate short-circuits to `{ skip: true }` with a descriptive label.

A no-op "skipped" test is registered explicitly so the test runner
emits a recognizable line instead of "0 tests" for the file.

## Synthetic-DOM shim (use sparingly)

For predicates that need to read `.offsetParent`, `.classList`, or
`document.querySelectorAll` against a hand-built DOM, you can build a
shim that exposes just enough surface. Example:

```js
function fakePage(dom) {
  const el = { innerHTML: dom, classList: { add() {}, remove() {}, contains: () => false, toggle: () => false } };
  return { evaluate(fn) { return fn(el); } };
}
```

This is **only** worth the effort when the predicate under test is too
complex to reduce to a string/regex. For most predicates, layer 1
(plain HTML + regex) is faster to write, easier to maintain, and runs
in <1ms per case.

## Fixture ownership

`scripts/ayoa-present-fixtures.js` is the single source of truth for the
Ayoa Present panel HTML. Any test that needs to assert DOM shape should
build its HTML via `buildPanelDom(opts)` and assert against the result.
Do not inline HTML in test files — when Ayoa changes the panel structure,
the fix is one edit in the fixture, not N edits across test files.

## Cross-parser invariant for OPML

When the production code has both a Node parser (`scripts/lib/opml-parser.js`)
and a Python parser (`scripts/tests/_pyayoa_opml.py`), the test must
prove both produce the same shape for the same input:

```js
const py = parseOpml(text);                 // Python via importlib
const js = jsParse(text);                   // Node via require
assert.equal(py.nodeCount, js.nodeCount);
assert.equal(py.maxDepth, js.maxDepth);
assert.deepEqual(
  py.nodes.map(n => n.text),
  js.nodes.map(n => n.text),
);
```

This invariant is what gives the contract its teeth: if either parser
drifts, the diff shows up immediately. Use 4-8 real OPML fixtures (not
synthetic), captured from real Ayoa exports.
