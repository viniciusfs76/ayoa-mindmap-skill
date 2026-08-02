'use strict';
// ayoa-clear-and-rebuild.js — Clear slides, rebuild, verify new titles
const fs = require('node:fs');
const PREFIX = process.env.PREFIX || '/data/data/com.termux/files/usr';
const loginModule = require('./import-opml.js');
const presenter = require('./ayoa-presenter.js');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.error(`[${new Date().toISOString().slice(11,23)}]`, ...a);

(async () => {
  const browser = await require('puppeteer-core').launch({
    executablePath: `${PREFIX}/lib/chromium/headless_shell`, headless: 'shell',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process'],
    defaultViewport: { width: 1440, height: 900 },
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    await page.setUserAgent('Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36');

    const cookies = JSON.parse(fs.readFileSync(`${process.env.HOME}/.cookiesAyoa-domain.json`, 'utf8'));
    await loginModule.login(page, cookies);
    log('Session established');

    await page.goto('https://app.ayoa.com/mindmaps/abe443ca-23c0-4487-9909-ca50e29f45a0', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(4000);

    // Dismiss cookie banner
    try { const btn = await page.$('button:has-text("Aceitar"),button:has-text("Accept")'); if (btn) await btn.click(); } catch {}
    await sleep(2000);

    // 1. Get current slide list
    log('Opening presenter...');
    const slides = await presenter.openPresenter(page);
    log(`Current slides: ${slides.length}`);
    for (const s of slides) log(`  Slide ${s.number}: "${(s.title||'').substring(0,50)}"`);

    // 2. Clear deck
    log('Clearing presentation deck...');
    const cleared = await presenter.clearPresentationDeck(page);
    log(`Cleared: ${cleared}`);
    await sleep(1500);

    // 3. Auto-create fresh slides
    log('Auto-creating slides from updated nodes...');
    const created = await presenter.autoCreatePresentation(page);
    log(`Created slides: ${created}`);
    await sleep(2000);

    // 4. Get new slide list
    const newSlides = await presenter.getSlideList(page);
    log(`New slides: ${newSlides.length}`);
    for (const s of newSlides) log(`  Slide ${s.number}: "${(s.title||'').substring(0,70)}"`);

    console.log(JSON.stringify({ ok: true, before: slides.length, after: newSlides.length, slides: newSlides }));
    process.exit(0);
  } catch (e) {
    log('FATAL:', e.message);
    console.log(JSON.stringify({ ok: false, error: e.message }));
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
