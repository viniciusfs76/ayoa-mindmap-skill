'use strict';
// Probe candidate endpoints for theme update by trying each with { themeId }.
// Run inside an authenticated page so we can fire fetch directly.

const puppeteer = require('puppeteer-core');
const fs = require('node:fs');
const { login } = require('./import-opml.js');

const MINDMAP_ID = process.argv[2] || '43e22adb-8c8f-46dd-875d-0cab56936dfd';
const COOKIES_FILE = process.env.HOME + '/.cookiesAyoa-domain.json';

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

    let captured = null;
    const onReq = r => {
      if (captured) return;
      const u = r.url();
      if (u.includes('/v2/import-jobs')) {
        const h = r.headers();
        captured = {
          'x-auth-token': h['x-auth-token'],
          'x-client-id': h['x-client-id'],
          'x-source': h['x-source'],
          'x-source-version': h['x-source-version'],
          'x-agent': h['x-agent'],
        };
      }
    };
    page.on('request', onReq);
    await page.evaluate(async () => { await fetch('/v2/import-jobs?t=' + Date.now(), { credentials: 'include' }).catch(() => null); });
    await new Promise(r => setTimeout(r, 500));
    page.off('request', onReq);

    const candidates = [
      { method: 'PATCH', url: `/v2/papers/${MINDMAP_ID}` },
      { method: 'PATCH', url: `/v2/papers/${MINDMAP_ID}?type=PAPER` },
      { method: 'PATCH', url: `/v2/mindmaps/${MINDMAP_ID}` },
      { method: 'PATCH', url: `/v2/mindmaps/${MINDMAP_ID}?type=PAPER` },
      { method: 'PATCH', url: `/v2/papers` },
      { method: 'PUT', url: `/v2/papers/${MINDMAP_ID}` },
      { method: 'POST', url: `/v2/papers/${MINDMAP_ID}/theme` },
      { method: 'POST', url: `/v2/mindmaps/${MINDMAP_ID}/theme` },
      { method: 'PATCH', url: `/v2/sync` },
      { method: 'POST', url: `/v2/sync` },
    ];
    const results = [];
    for (const c of candidates) {
      const r = await page.evaluate(async ({ method, url, headers, body }) => {
        const res = await fetch(url, { method, credentials: 'include', headers: { 'content-type': 'application/json', ...headers }, body });
        const text = await res.text().catch(() => '');
        return { status: res.status, body: text.slice(0, 200) };
      }, { method: c.method, url: c.url, headers: captured, body: JSON.stringify({ themeId: 'radial' }) });
      results.push({ ...c, ...r });
      console.log(c.method, c.url, '->', r.status, r.body.slice(0, 100));
    }
    fs.writeFileSync('/data/data/com.termux/files/home/tmp/ayoa-theme-probe.json', JSON.stringify({ headers: captured, results }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });