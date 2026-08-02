'use strict';
// Probe Ayoa's v2 API while loading a mind map. Captures all requests under
// /v2/ and dumps them so we can locate the style/theme endpoint.
//
// Run: node ayoa-probe-api.js <mindmapId>

const puppeteer = require('puppeteer-core');
const fs = require('node:fs');
const { login } = require('./import-opml.js');

const MINDMAP_ID = process.argv[2] || '43e22adb-8c8f-46dd-875d-0cab56936dfd';
const COOKIES_FILE = process.env.HOME + '/.cookiesAyoa-domain.json';
const OUT = '/data/data/com.termux/files/home/tmp/ayoa-probe-api.json';

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
  const calls = [];
  try {
    const page = await browser.newPage();
    page.on('request', r => {
      const u = r.url();
      if (!u.includes('app.ayoa.com')) return;
      const p = r.postData();
      const url = u.replace('https://app.ayoa.com', '');
      const h = r.headers();
      const captured = {};
      for (const k of ['x-auth-token','x-client-id','x-source','x-source-version','x-agent','x-request-id']) {
        if (h[k]) captured[k] = k === 'x-auth-token' ? '<present>' : h[k];
      }
      calls.push({
        method: r.method(),
        url,
        hasBody: !!p,
        bodySample: p ? p.slice(0, 240) : null,
        reqHeaders: captured,
      });
    });
    page.on('response', async r => {
      const u = r.url();
      if (!u.includes('app.ayoa.com') || !u.includes('/v2/')) return;
      const url = u.replace('https://app.ayoa.com', '');
      const body = await r.text().catch(() => null);
      const idx = calls.findIndex(c => c.url === url && c.status == null);
      const status = r.status();
      if (idx >= 0) {
        calls[idx].status = status;
        calls[idx].response = body || null;  // full body, no truncation
      }
    });

    const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE));
    await login(page, cookies);
    // Capture auth headers from the first /v2/ request so we can replay
    // them later when we POST/PATCH the style endpoint.
    const authHeaders = await page.evaluate(async () => {
      try {
        const r = await fetch('/v2/import-jobs?t=' + Date.now(), { credentials: 'include' });
        const h = {};
        for (const k of ['x-auth-token','x-client-id','x-source','x-source-version','x-agent']) {
          if (r.headers.get(k)) h[k] = r.headers.get(k);
        }
        return h;
      } catch { return {}; }
    });
    fs.writeFileSync('/data/data/com.termux/files/home/tmp/ayoa-probe-auth.json', JSON.stringify(authHeaders, null, 2));
    await new Promise(r => setTimeout(r, 2500));
    await page.goto(`https://app.ayoa.com/mindmaps/${MINDMAP_ID}`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 5000));

    fs.writeFileSync(OUT, JSON.stringify({ mindmapId: MINDMAP_ID, totalCalls: calls.length, calls }, null, 2));
    const v2 = calls.filter(c => c.url.includes('/v2/'));
    console.log('total calls:', calls.length, '| /v2/ calls:', v2.length);
    console.log('all /v2/ paths:');
    v2.forEach(c => console.log(' ', c.method, c.url, c.status || ''));
  } finally {
    await browser.close();
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });