'use strict';
// Probe: try a series of patch paths against /v2/sync to find which one
// actually persists. Goal: discover the correct patch shape for /themeId
// (and similar top-level fields) on a real mind map.
//
// Discovery plan:
//   1. Read current /themeId via /v2/init.
//   2. PATCH with each candidate shape against a SIDE-FIELD first
//      (branchThickness), since it has integer values that change visibly.
//   3. Verify which shape produced a visible change.

const puppeteer = require('puppeteer-core');
const fs = require('node:fs');
const { login } = require('./import-opml.js');

const MINDMAP_ID = process.argv[2] || '43e22adb-8c8f-46dd-875d-0cab56936dfd';
const COOKIES_FILE = process.env.HOME + '/.cookiesAyoa-domain.json';
const OUT = '/data/data/com.termux/files/home/tmp/ayoa-probe-patch-shape.json';

(async () => {
  // Pre-flight cookie validation
  const cvPath = require('path').join(process.env.HOME, '.hermes/skills/ayoa-login/scripts/lib/cookie-validator.js');
  const { validateCookies } = require(cvPath);
  const cookieCheck = validateCookies(COOKIES_FILE, { ignoreCache: false });
  if (cookieCheck.status === 'EXPIRED') {
    console.error(`✗ Cookies expired: ${cookieCheck.reason}. Re-export from Chrome.`);
    process.exit(2);
  }
  console.error(`Cookie preflight: ${cookieCheck.status}`);

  const browser = await puppeteer.launch({
    executablePath: process.env.PREFIX + '/lib/chromium/headless_shell',
    headless: 'shell',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process'],
    defaultViewport: { width: 1440, height: 900 },
  });
  try {
    const page = await browser.newPage();
    const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE));
    await login(page, cookies);

    // Capture headers.
    let captured = null;
    const onReq = r => {
      if (captured) return;
      const u = r.url();
      if (u.includes('app.ayoa.com/v2/')) {
        const h = r.headers();
        if (h['x-auth-token']) {
          captured = {
            'x-auth-token': h['x-auth-token'],
            'x-client-id': h['x-client-id'],
            'x-source': h['x-source'],
            'x-source-version': h['x-source-version'],
            'x-agent': h['x-agent'],
          };
        }
      }
    };
    page.on('request', onReq);
    await new Promise(r => setTimeout(r, 4000));
    if (!captured) {
      await page.goto(`https://app.ayoa.com/mindmaps/${MINDMAP_ID}`, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 6000));
    }
    page.off('request', onReq);
    if (!captured) throw new Error('headers not captured');

    // Capture userId from /v2/init response.
    let userId = null;
    const onInit = async r => {
      try {
        const u = r.url();
        if (!u.includes('/v2/init') || userId) return;
        const j = await r.json();
        if (j && j.user && j.user._id) userId = j.user._id;
      } catch {}
    };
    page.on('response', onInit);
    if (!page.url().includes(`/mindmaps/${MINDMAP_ID}`)) {
      await page.goto(`https://app.ayoa.com/mindmaps/${MINDMAP_ID}`, { waitUntil: 'domcontentloaded' });
    }
    for (let i = 0; i < 20 && !userId; i++) await new Promise(r => setTimeout(r, 500));
    page.off('response', onInit);
    if (!userId) throw new Error('userId not captured');

    const clientId = captured['x-client-id'];
    const ts = new Date().toISOString();

    // Try 6 patch shapes against /branchThickness (currently 10; target 12).
    const candidates = [
      { label: 'plain patch', patches: [{ op: 'UPDATE', path: '/branchThickness', value: 12 }] },
      { label: 'with _p0.matchKey', patches: [{ op: 'UPDATE', path: '/branchThickness', value: 12, _p0: { matchKey: MINDMAP_ID } }] },
      { label: 'set replace op', patches: [{ op: 'REPLACE', path: '/branchThickness', value: 12 }] },
      { label: 'array of patches w/ themeId same time', patches: [{ op: 'UPDATE', path: '/themeId', value: 'radial' }, { op: 'UPDATE', path: '/branchThickness', value: 12 }] },
      { label: 'paperSettings2', patches: [{ op: 'UPDATE', path: '/paperSettings2/branchThickness', value: 12 }] },
      { label: 'themeId via paperSettings2', patches: [{ op: 'UPDATE', path: '/paperSettings2/themeId', value: 'radial' }] },
    ];

    const results = [];
    for (const c of candidates) {
      const body = JSON.stringify({
        messages: [{
          _id: crypto.randomUUID(),
          timestamp: ts,
          data: { type: 'USER', id: userId, patches: c.patches },
          clientId,
          type: 'UPDATE_ENTITY',
          sent: false,
          userId,
          paperId: MINDMAP_ID,
        }],
        numberQueuedMessage: 1,
      });
      const r = await page.evaluate(async ({ body, headers }) => {
        const res = await fetch('/v2/sync', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', ...headers },
          body,
        });
        const text = await res.text();
        return { status: res.status, body: text.slice(0, 200) };
      }, { body, headers: captured });
      results.push({ label: c.label, status: r.status, body: r.body, sentBody: body });
      console.log(c.label, '->', r.status, r.body.slice(0, 100));
      await new Promise(r => setTimeout(r, 1500));
    }
    fs.writeFileSync(OUT, JSON.stringify({ results }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });