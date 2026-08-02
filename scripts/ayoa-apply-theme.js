'use strict';
// scripts/ayoa-apply-theme.js — change the themeId (branch style) of an
// existing Ayoa mind map by sending a JSON Patch via POST /v2/sync.
//
// The endpoint and payload were discovered by scripts/ayoa-capture-while-
// formatting.js + scripts/ayoa-probe-api.js (see /v2/sync messages array).
//
// Run: node ayoa-apply-theme.js --target <mindmapId-or-url> --themeId <id>
// Valid themeIds (seen in /v2/init): box, capture, direction, dsa,
//   organic, organic_dsa, organic_v2, radial, speed.

const puppeteer = require('puppeteer-core');
const fs = require('node:fs');
const { login } = require('./import-opml.js');

const args = (() => {
  const a = {};
  for (let i = 2; i < process.argv.length; i++) {
    const k = process.argv[i].replace(/^--/, '');
    const v = process.argv[i + 1];
    if (v && !v.startsWith('--')) { a[k] = v; i++; } else { a[k] = true; }
  }
  return a;
})();

const TARGET = args.target || (() => { throw new Error('--target required') })();
const MINDMAP_ID = (TARGET.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/) || [''])[0] || TARGET;
const COOKIES_FILE = args.cookies || `${process.env.HOME}/.cookiesAyoa-domain.json`;
const THEME_ID = args.themeId;
const OUT = '/data/data/com.termux/files/home/tmp/ayoa-apply-theme-result.json';

if (!THEME_ID) {
  console.error('Usage: node ayoa-apply-theme.js --target <uuid-or-url> --themeId <id>');
  console.error('Valid themeIds: box, capture, direction, dsa, organic, organic_dsa, organic_v2, radial, speed');
  process.exit(2);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.PREFIX + '/lib/chromium/headless_shell',
    headless: 'shell',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process'],
    defaultViewport: { width: 1440, height: 900 },
  });
  let result = { ok: false, mindmapId: MINDMAP_ID, themeId: THEME_ID };
  try {
    // Pre-flight cookie validation
    const cvPath = require('path').join(process.env.HOME, '.hermes/skills/ayoa-login/scripts/lib/cookie-validator.js');
    const { validateCookies } = require(cvPath);
    const cookieCheck = validateCookies(COOKIES_FILE, { ignoreCache: false });
    if (cookieCheck.status === 'EXPIRED') {
      throw new Error(`Cookies expired: ${cookieCheck.reason}. Re-export from Chrome.`);
    }
    console.error(`Cookie preflight: ${cookieCheck.status} — ${cookieCheck.reason}`);

    const page = await browser.newPage();
    const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE));
    await login(page, cookies);

    // Capture auth headers from the FIRST /v2/* request that fires after
    // we attach the listener. The Ayoa dashboard fires /v2/analytics-events
    // every ~30s, so attach BEFORE navigation and wait for any /v2/ hit.
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

    // Wait briefly for the next /v2/ request; if none arrives, navigate to
    // the mindmap to trigger /v2/init which carries the headers.
    await new Promise(r => setTimeout(r, 4000));
    if (!captured) {
      await page.goto(`https://app.ayoa.com/mindmaps/${MINDMAP_ID}`, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 6000));
    }
    page.off('request', onReq);

    if (!captured) throw new Error('Failed to capture auth headers from any /v2/ request');
    const headers = captured;

    // Fetch the user id by hooking the /v2/init response that Ayoa fires
    // automatically when the mindmap page loads. The browser-side fetch
    // in page.evaluate is unreliable for the 8.5 MB init response, so we
    // intercept it via CDP and read JSON.user._id.
    let userId = null;
    const onInitResp = async r => {
      try {
        const u = r.url();
        if (!u.includes('/v2/init') || userId) return;
        const j = await r.json();
        if (j && j.user && j.user._id) userId = j.user._id;
      } catch {}
    };
    page.on('response', onInitResp);
    // Trigger /v2/init by visiting the mindmap if not already there.
    if (!page.url().includes(`/mindmaps/${MINDMAP_ID}`)) {
      await page.goto(`https://app.ayoa.com/mindmaps/${MINDMAP_ID}`, { waitUntil: 'domcontentloaded' });
    }
    // Wait up to 10s for the init response to land.
    for (let i = 0; i < 20 && !userId; i++) await new Promise(r => setTimeout(r, 500));
    page.off('response', onInitResp);
    if (!userId) {
      throw new Error('Failed to capture user id from /v2/init response (10s timeout)');
    }

    // Build the JSON Patch message. Mirror the exact shape captured from the
    // Ayoa UI: messages[] with type UPDATE_ENTITY and a list of patches.
    // The /themeId patch (like /paperSettings2/_p0/lastOpenedAt) needs a
    // _p0.matchKey wrapper that names the target paper; otherwise the
    // server returns 204 without applying the change.
    const clientId = headers['x-client-id'];
    const msgId = crypto.randomUUID();
    const ts = new Date().toISOString();
    const body = JSON.stringify({
      messages: [{
        _id: msgId,
        timestamp: ts,
        data: {
          type: 'USER',
          id: userId,
          patches: [{
            op: 'UPDATE',
            path: '/themeId',
            value: THEME_ID,
            _p0: { matchKey: MINDMAP_ID },
          }],
        },
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
      return { status: res.status, body: text.slice(0, 400) };
    }, { body, headers });

    result = {
      ...result,
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      response: r.body,
      sentBody: body,
      userId,
      capturedHeaders: headers,
    };
  } catch (e) {
    result = { ...result, error: e.message, stack: e.stack };
    if (e.message && (e.message.includes('auth') || e.message.includes('login') || e.message.includes('redirect'))) {
      try {
        const cvPath = require('path').join(process.env.HOME, '.hermes/skills/ayoa-login/scripts/lib/cookie-validator.js');
        const { invalidateCache } = require(cvPath);
        invalidateCache();
        console.error('Cookie cache invalidated due to auth failure');
      } catch {}
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
})();