# Ayoa Capture Flow — Test Pattern (Puppeteer E2E)

Validated 2026-07-16 against `tests/ayoa-multi-slide-capture.test.js` (5/5 unique
PNGs by sha256) and against production capture of mapa `f184cfe2-…` (69 slides,
0 collisions, 0 recovery). This file is the durable recipe; the test file is the
concrete instance.

## The 5-step pattern

A multi-slide recording is reliable if and only if these 5 invariants hold.
Encode each as an assertion in `node --test`:

1. **Build a synthetic Ayoa Present panel via `buildPanelDom({deckSize})`**.
   Do NOT try to scrape `app.ayoa.com` for the test DOM — it is React and
   shadow-heavy; build a minimal HTML mirror that exposes the same controls
   (`.slides-list-group-item`, `.slides-list-container`, `.slides-play-stop-button`,
   `.map-canvas`). One source of truth, owned by `ayoa-present-fixtures.js`.

2. **Enter Present mode and wait `.presenting` on the panel.**
   Click `.slides-play-stop-button`. The fixture's handler schedules
   `select(items[0])` via `setTimeout(..., 200)`. **You must `await sleep(250)`
   before any subsequent select**, otherwise the canvas re-render from the
   deferred select races your first screenshot and slide-001 == slide-002.
   This is the single most-biting race in the Ayoa capture flow.

3. **For each slide: click item → waitForFunction predicate → screenshot.**
   The waitForFunction predicate is BOTH:
   - `selectedItemIndex === expectedIdx`, AND
   - `panel.classList.contains('presenting')`.
   Either alone is not enough — `activeId` can move without the canvas
   re-rendering, and the canvas can re-render without `activeId` moving.
   Both together is the only correct readiness signal.

4. **Screenshot, hash, assert uniqueness.**
   Capture each slide as PNG, sha256 it, and assert the set of hashes has
   `DECK` distinct values. Duplicates mean the canvas did not move between
   two navigation steps — that is the "static slide" bug.

5. **Assert each PNG is > 1 KB and the screenshot lands in a writable dir.**
   Guards against blank-canvas fallback (handler errored silently and produced
   an empty viewport PNG).

## Why this matters

The "static slide" bug is the failure mode the user keeps hitting:

> "slides saved are the static ones not the presentation running through
> forward arrow ones"

The cause is one of three:

- **Race**: select was called, but the canvas did not re-render before the
  screenshot. Fix: enforce `activeId === expected && presenting` before screenshot.
- **Wrong target**: a different navigation predicate was used (e.g., `Ctrl+A`
  on the canvas, which Ayoa does not honour for selection). Fix: click the
  item in `.slides-list-group-item`.
- **Theme switch miss**: Ayoa UI's first-render path differs from subsequent
  render paths, so the very first transition is racy. Fix: the 250ms sleep
  in step 2.

The `tests/ayoa-multi-slide-capture.test.js` test fails ~10% of runs without
the 250ms sleep. With it, 10/10 consecutive runs pass. This is empirical.

## The fixture must have per-slide canvas variation

A naive fixture renders all slide items identically, so the screenshot is the
same DOM regardless of `selectedItemIndex`. Production Ayoa re-renders the
canvas when the active slide changes. The fixture must do the same — the
`buildPanelDom` canvas re-renders inside its `select()` handler:

```js
const select = (el) => {
  items().forEach(x => x.classList.remove('selected'));
  if (el) el.classList.add('selected');
  const canvas = document.querySelector('.map-canvas');
  if (canvas) {
    const idx = items().indexOf(el);
    const title = el.querySelector('.slides-list-group-content')?.innerText || 'Slide';
    canvas.innerHTML =
      '<div class="map-node active" data-slide-index="' + idx + '">'
      + '<div class="map-node-title">' + title + '</div>'
      + '<div class="map-node-body">Slide ' + (idx + 1) + ' of ' + items().length + '</div>'
      + '</div>';
  }
};
```

Without this, the test passes `assert.equal(uniqueHashes, DECK)` only because
the canvas is the same — which is exactly the bug we are testing for.

## Skip-on-missing-Chromium guard

`puppeteer-core` requires `headless_shell` at `$PREFIX/lib/chromium/headless_shell`
in the Termux sandbox. The test must skip gracefully when the binary is absent
or the npm dep is missing. Pattern:

```js
const HAS_CHROMIUM = fs.existsSync(CHROME);
let puppeteer; try { puppeteer = require('puppeteer-core'); } catch { puppeteer = null; }
test('puppeteer: multi-slide capture', { skip: !HAS_CHROMIUM || !puppeteer }, async () => { ... });
```

In CI without Chromium the suite still proves the contract via the deterministic
predicate-level tests (the 5 `ayoa-capture-flow.test.js` cases).

## Anti-patterns

- **Don't** use `Ctrl+A` to "select all" then click Formatar. Ayoa treats Ctrl+A
  in the canvas as a Zoom-all, not as multi-select.
- **Don't** wait `WAIT_MS` once and then screenshot every slide in a loop.
  Per-slide wait is mandatory because Ayoa's transition timer is not constant.
- **Don't** trust the `.presenting` class alone. The class persists across
  exits and re-entries; only the `activeId` check tells you the canvas moved.
- **Don't** run multiple suites that each spawn `headless_shell` in parallel
  — the pool deadlocks and every suite returns 0/0. See
  `references/pitfalls.md` pitfall v1.7.0.

## Production alignment

`scripts/ayoa-capture-slides.js` and `ayoa-presenter.js` use the same
primitives — `goToSlideForCapture`, `enterPresentationMode`,
`advanceToSlideViaNextArrow` — exported from `ayoa-presenter.js`. The test is
the canonical contract for what those helpers must satisfy. If you change the
helpers, change the test in the same commit.

## Linked tests

- `tests/ayoa-capture-flow.test.js` — pure-Node, predicate-level (5 cases, <500ms).
- `tests/ayoa-multi-slide-capture.test.js` — Puppeteer E2E (1 case, ~2s).

Combined they give fast feedback during local edits and full E2E coverage
when Chromium is available.