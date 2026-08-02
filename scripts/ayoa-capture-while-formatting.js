'use strict';
// scripts/ayoa-capture-while-formatting.js — passive capture of the body
// of POST/PATCH requests under /v2/ while the user interacts with the Ayoa
// canvas. Used to discover the exact endpoint and payload the Ayoa UI sends
// when the user picks a new "Tema" (theme / branch style).
//
// Usage:
//   node ayoa-capture-while-formatting.js <mindmapId>
// The script loads the mind map, keeps the browser open for 5 minutes, and
// logs every POST/PATCH under /v2/ to /data/data/com.termux/files/home/tmp/
// ayoa-format-capture.jsonl (one JSON line per request).

const puppeteer = require('puppeteer-core');
const fs = require('node:fs');
const { login } = require('./import-opml.js');

const MINDMAP_ID = process.argv[2] || '43e22adb-8c8f-46dd-875d-0cab56936dfd';
const COOKIES_FILE = process.env.HOME + '/.cookiesAyoa-domain.json';
const OUT = '/data/data/com.termux/files/home/tmp/ayoa-format-capture.jsonl';
const OPEN_MINUTES = parseInt(process.env.OPEN_MINUTES || '5', 10);

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

  fs.writeFileSync(OUT, '');
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

    page.on('request', r => {
      const u = r.url();
      if (!u.includes('app.ayoa.com')) return;
      const url = u.replace('https://app.ayoa.com', '');
      const m = r.method();
      if (m !== 'POST' && m !== 'PATCH' && m !== 'PUT') return;
      if (!url.startsWith('/v2/')) return;
      const body = r.postData();
      const headers = r.headers();
      const captured = {
        t: new Date().toISOString(),
        method: m,
        url,
        body: body || null,
        reqHeaders: {
          'x-auth-token': headers['x-auth-token'] ? '<present>' : null,
          'x-client-id': headers['x-client-id'] || null,
          'x-source': headers['x-source'] || null,
          'x-source-version': headers['x-source-version'] || null,
          'x-agent': headers['x-agent'] || null,
          'x-request-id': headers['x-request-id'] || null,
        },
      };
      fs.appendFileSync(OUT, JSON.stringify(captured) + '\n');
      console.log(`[${captured.t}] ${m} ${url} body=${(body || '').slice(0, 200)}`);
    });
    page.on('response', async r => {
      const u = r.url();
      if (!u.includes('app.ayoa.com')) return;
      const url = u.replace('https://app.ayoa.com', '');
      if (!(url.startsWith('/v2/') && (r.request().method() === 'POST' || r.request().method() === 'PATCH'))) return;
      try {
        const text = await r.text();
        console.log(`  -> ${r.status()} ${url} body=${text.slice(0, 200)}`);
      } catch {}
    });

    console.log('Navigating to mindmap and keeping the page alive for', OPEN_MINUTES, 'minutes.');
    console.log('Open the same mind map in the Android browser, change Tema via Formatar, and watch the captures here.');
    await page.goto(`https://app.ayoa.com/mindmaps/${MINDMAP_ID}`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 4000));
    console.log('Page loaded. URL =', page.url());
    console.log('Standing by for POST/PATCH /v2/* requests...');
    await new Promise(r => setTimeout(r, OPEN_MINUTES * 60 * 1000));
    console.log('Window expired. Captures saved to', OUT);
  } finally {
    await browser.close();
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });