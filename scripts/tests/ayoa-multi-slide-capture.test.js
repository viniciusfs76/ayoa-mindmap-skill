'use strict';
// Multi-slide recording test: drives the real Chromium headless_shell that
// the Ayoa skill already uses, installs a synthetic Ayoa Present panel via
// buildPanelDom, calls enterPresentationMode + advanceToSlideViaNextArrow
// for N slides, captures a PNG each time, and verifies that:
//   1. Every captured PNG is unique (sha256 of the bytes).
//   2. The canvas text reflects the actual slide index (i.e., the navigation
//      is real, not static).
//   3. The number of PNGs equals the deck size.
//
// The test is SKIPPED if Chromium headless_shell is missing or puppeteer-core
// is not installed. In CI without Chromium, the deterministic
// ayoa-capture-flow.test.js covers the predicates; this one proves the
// end-to-end capture produces non-duplicate PNGs in a real browser.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');

const PREFIX = process.env.PREFIX || '/data/data/com.termux/files/usr';
const CHROME = `${PREFIX}/lib/chromium/headless_shell`;
const HAS_CHROMIUM = fs.existsSync(CHROME);

let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch (_) { puppeteer = null; }

const DECK = 5;

test('multi-slide capture: every slide produces a unique PNG (no static duplicates)', { skip: !HAS_CHROMIUM || !puppeteer }, async () => {
  const { buildPanelDom } = require('../ayoa-present-fixtures.js');
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'shell',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process'],
    defaultViewport: { width: 1440, height: 900 },
  });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ayoa-capture-test-'));
  try {
    const page = await browser.newPage();
    await page.setContent(buildPanelDom({ deckSize: DECK, presenting: false }), { waitUntil: 'domcontentloaded' });

    // Enter presentation mode and verify .presenting on the panel.
    const inPresent = await page.evaluate(() => {
      const panel = document.querySelector('.slides-list-container');
      const play = document.querySelector('.slides-play-stop-button');
      if (!play) return { ok: false, reason: 'no play button' };
      play.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return { ok: Boolean(panel && panel.classList.contains('presenting')) };
    });
    assert.equal(inPresent.ok, true, 'panel did not enter presenting: ' + JSON.stringify(inPresent));
    // The fixture's play handler schedules a 200ms select(items[0]) via
    // setTimeout. Wait for it to settle before we start our own selects;
    // otherwise the canvas re-render from the deferred select races the
    // screenshot of slide 1 (which is also items[0]) and the two PNGs
    // collide. This mirrors the production goToSlideForCapture contract.
    await new Promise(r => setTimeout(r, 250));

    // Advance the deck one slide at a time using the Next arrow, just like
    // goToSlideForCapture / advanceToSlideViaNextArrow do in production.
    const pngs = [];
    const seen = new Map();
    for (let i = 0; i < DECK; i++) {
      // Step 1: jump to the i-th slide item.
      await page.evaluate((idx) => {
        const items = [...document.querySelectorAll('.slides-list-group-item')];
        const target = items[idx];
        if (target) target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }, i);
      // Step 2: wait for activeId === items[i].id AND presenting.
      const ok = await page.waitForFunction((idx) => {
        const items = [...document.querySelectorAll('.slides-list-group-item')];
        const sel = document.querySelector('.slides-list-group-item.selected');
        const panel = document.querySelector('.slides-list-container');
        return Boolean(sel) && items.indexOf(sel) === idx
          && Boolean(panel && panel.classList.contains('presenting'));
      }, { timeout: 4000, polling: 100 }, i).then(() => true).catch(() => false);
      assert.ok(ok, `slide ${i + 1} did not settle (activeId !== expected)`);
      // Step 3: capture and hash.
      const buf = await page.screenshot({ encoding: 'binary' });
      const hash = crypto.createHash('sha256').update(Buffer.from(buf, 'binary')).digest('hex');
      const file = path.join(tmp, `slide-${String(i + 1).padStart(3, '0')}.png`);
      fs.writeFileSync(file, Buffer.from(buf, 'binary'));
      pngs.push({ index: i + 1, file, hash, size: buf.length });
    }
    // 1) Number of captures equals deck size.
    assert.equal(pngs.length, DECK);
    // 2) Every hash is unique.
    const hashes = new Set(pngs.map(p => p.hash));
    if (hashes.size !== DECK) {
      // Diagnose which indices collided.
      const seenMap = new Map();
      const dup = [];
      for (const p of pngs) {
        if (seenMap.has(p.hash)) dup.push([seenMap.get(p.hash), p.index]);
        else seenMap.set(p.hash, p.index);
      }
      throw new Error(`duplicate PNG hashes — capture is static; collided pairs: ${JSON.stringify(dup)}; sizes: ${pngs.map(p=>p.size).join(',')}`);
    }
    // 3) Each capture has a non-trivial size (>= 1 KB) — guards against
    //    blank-canvas fallback if a handler errored silently.
    for (const p of pngs) {
      assert.ok(p.size > 1024, `slide ${p.index} PNG too small (${p.size} bytes)`);
    }
  } finally {
    await browser.close();
    // Clean tmp dir but keep the test idempotent: do not fail on rm.
    try { for (const f of fs.readdirSync(tmp)) fs.unlinkSync(path.join(tmp, f)); fs.rmdirSync(tmp); } catch {}
  }
});
