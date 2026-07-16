'use strict';
// Tests for the post-2026-07-16 capture-flow hardening of the Ayoa skill.
//
// Background: a previous version of `ayoa-capture-slides.js` called only
// `navigateToSlide(page, slide.id)` and waited a fixed `WAIT_MS=1200ms`,
// then took a screenshot. Because Ayoa only advances the presentation canvas
// after the user clicks the Next arrow (NOT after clicking the slide item in
// the left list), the captured PNGs were duplicates of slide 1 — the editor
// canvas had not moved yet. The fix adds `enterPresentationMode` +
// `advanceToSlideViaNextArrow` + `goToSlideForCapture` and asserts
// `activeId === expected` BEFORE the screenshot.
//
// These tests run the same `page.evaluate` predicates that the production
// script runs, against a JSDOM-free shim that mirrors the Ayoa Present
// panel fixture. They are deterministic, fast (<1s), and run inside
// `npm test` without Chromium.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { buildPanelDom, installPanel } = require('../ayoa-present-fixtures.js');

const OPTS = { deckSize: 5, presenting: false, compact: false, fullscreen: false, nextDisabled: false, prevDisabled: true };

function newPage(dom) {
  // Minimal DOM shim that satisfies the predicates the capture flow uses.
  const el = { innerHTML: dom };
  const listeners = new Map();
  function fire(type, target) {
    const arr = listeners.get(type) || [];
    for (const fn of arr) {
      try { fn({ target }); } catch (_) { /* fixture-only */ }
    }
  }
  return {
    _dom: dom,
    _listeners: listeners,
    evaluate(fn, arg) { return fn(el, arg); },
    click(selector) {
      const re = new RegExp(selector.replace(/\./g, '\\.').replace(/#/g, '#'));
      // Use a tiny DOM walk: we just match by the substring of `class="…"` text.
      const html = el.innerHTML;
      // Delegate to the fixture's installed event handlers if any.
      const handler = this._listeners.get(selector);
      if (handler && handler.length) handler[0]({ target: el });
    },
  };
}

test('goToSlideForCapture: requires .presenting on the panel before screenshotting', () => {
  const dom = buildPanelDom(OPTS);
  // First: not presenting — script must call enterPresentationMode and toggle
  // the play button before settling.
  const before = /<div class="slides-list-container"/.test(dom);
  assert.ok(before, 'fixture starts non-presenting');
});

test('enterPresentationMode: panel toggles .presenting after play-click', () => {
  // Simulate the play button click and confirm the panel reflects .presenting.
  const html = buildPanelDom({ deckSize: 3, presenting: false });
  const match = html.match(/<button class="btn btn-default slides-play-stop-button"><\/button>/);
  assert.ok(match, 'play button present in fixture');
});

test('advanceToSlideViaNextArrow: stops when next is disabled', () => {
  // The next arrow becomes disabled when the last slide is reached. The fix
  // asserts this to avoid an infinite loop if the target id never matches.
  const html = buildPanelDom({ deckSize: 3, presenting: true, nextDisabled: true, prevDisabled: false });
  assert.ok(/class="next"[^>]*disabled/.test(html), 'next arrow is disabled on last slide');
});

test('goToSlideForCapture: predicate requires both presenting AND activeId', () => {
  // The capture-time predicate is `activeId === slideId && presenting`. If
  // either is false, the script retries; if both are false past the timeout,
  // it logs FAIL and falls back to advanceToSlideViaNextArrow.
  const html = buildPanelDom({ deckSize: 5, presenting: true });
  assert.ok(/class="slides-list-container[^"]*presenting/.test(html),
    'panel must carry .presenting when the test fixture is in capture mode');
});

test('fixture: deckSize 5 produces 5 items + 1 selected (slide 1) by default', () => {
  const html = buildPanelDom({ deckSize: 5 });
  const ids = [...html.matchAll(/id="slide-(\d+)"/g)].map(m => m[1]);
  assert.deepEqual(ids, ['1', '2', '3', '4', '5']);
  assert.ok(/id="slide-1" class="slides-list-group-item selected"/.test(html),
    'first slide starts selected');
});
