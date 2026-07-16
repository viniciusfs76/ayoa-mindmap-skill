'use strict';
// Live Puppeteer test: drives the real Chromium headless_shell that the
// Ayoa skill already uses, mocks app.ayoa.com with a tiny HTML fixture
// that mirrors the dashboard and the "Novo projeto" modal, and asserts
// the import-opml.js helpers behave as the production flow did when the
// world-cup-final-2026-strict.opml was uploaded.
//
// The test is SKIPPED if Chromium headless_shell is not available in the
// sandbox (PREFIX/lib/chromium/headless_shell) or if the npm dependency
// puppeteer-core is missing. In CI without Chromium, the suite still
// proves the contract via the deterministic ayoa-import-pick-input
// suite that runs in the same npm test invocation.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PREFIX = process.env.PREFIX || '/data/data/com.termux/files/usr';
const CHROME = `${PREFIX}/lib/chromium/headless_shell`;
const HAS_CHROMIUM = fs.existsSync(CHROME);

const { pickBoardNameInput, deriveBoardName, parseOpml } = require('../import-opml.js');
const { parseOpml: jsParse } = require('../lib/opml-parser.js');

const FIX = path.join(__dirname, 'fixtures');
const OPML = (name) => path.join(FIX, name);

const AYO_A_FIXTURE_HTML = `<!doctype html><html><body>
  <input type="text" placeholder="Pesquisar projetos" aria-label="Search projects">
  <div class="create-modal">
    <input type="text" placeholder="Digite o nome do seu projeto" aria-label="">
    <button class="create-option-import">Importar</button>
    <input type="file" accept=".opml,.txt,.md,.html">
    <button>Importar</button>
  </div>
</body></html>`;

let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch (_) { puppeteer = null; }

const live = test('puppeteer: pickBoardNameInput finds the modal title in real Chromium', { skip: !HAS_CHROMIUM || !puppeteer }, async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'shell',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process'],
    defaultViewport: { width: 1440, height: 900 },
  });
  try {
    const page = await browser.newPage();
    await page.setContent(AYO_A_FIXTURE_HTML, { waitUntil: 'domcontentloaded' });
    const picked = await page.evaluate(() => {
      const els = [...document.querySelectorAll('input[type="text"], input:not([type])')];
      return els.map(el => ({
        placeholder: el.placeholder || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        offsetParent: el.offsetParent,
      }));
    });
    const result = pickBoardNameInput(picked);
    assert.ok(result, 'pickBoardNameInput returned null');
    assert.equal(result.placeholder, 'Digite o nome do seu projeto');

    const opmlText = fs.readFileSync(OPML('world-cup-final-2026-strict.opml'), 'utf8');
    const name = deriveBoardName(opmlText, null);
    assert.equal(name, 'World Cup Final 2026 - Argentina vs Spain');

    // Round-trip: Node parser and Python parser produce the same shape.
    const py = parseOpml(opmlText);
    const js = jsParse(opmlText);
    assert.equal(py.nodeCount, js.nodeCount);
    assert.equal(py.maxDepth, js.maxDepth);
    assert.equal(py.title, js.title);
    assert.equal(py.central, js.central);
  } finally {
    await browser.close();
  }
});

if (!HAS_CHROMIUM) {
  test('puppeteer: skipped (chromium not present in sandbox)', { skip: true }, () => {});
}
