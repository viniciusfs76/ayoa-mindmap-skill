'use strict';
// import-opml-v2.js — Importação OPML no Ayoa via drag-and-drop nativo.
//
// Estratégia: localiza o botão "Import" na UI, clica, espera o dropzone,
// então simula drag-and-drop do arquivo OPML usando DataTransfer +
// dispatchEvent('drop'). Isso contorna o canvas Shadow DOM do Ayoa.

const puppeteer = require('puppeteer-core');
const fs = require('node:fs');
const path = require('node:path');

const PREFIX = process.env.PREFIX || '/data/data/com.termux/files/usr';
const CHROME = `${PREFIX}/lib/chromium/headless_shell`;

function parseArgs() {
  const out = { _pos: [] };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = process.argv[i + 1];
      if (v && !v.startsWith('--')) { out[k] = v; i++; }
      else out[k] = true;
    } else out._pos.push(a);
  }
  return out;
}

const ARGS = parseArgs();
const COOKIES = ARGS.cookies || `${process.env.HOME}/tmp/ayoa-cookies-test.json`;
const OPML = ARGS.opml || `${process.env.HOME}/tmp/waico-maco.opml`;
const OUTPUT = ARGS.output || `${process.env.HOME}/tmp/import-opml-v2-result.json`;
const SCREENSHOT = ARGS.screenshot || `${process.env.HOME}/.ayoa-import-opml-v2.png`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.error(`[${new Date().toISOString().slice(11, 23)}]`, ...a);

(async () => {
  log('Reading OPML...');
  const opmlContent = fs.readFileSync(OPML, 'utf8');
  log(`OPML: ${OPML} (${opmlContent.length} bytes)`);

  // Pre-flight cookie validation before launching Puppeteer
  const cvPath = require('path').join(process.env.HOME, '.hermes/skills/ayoa-login/scripts/lib/cookie-validator.js');
  const { validateCookies } = require(cvPath);
  const cookieCheck = validateCookies(COOKIES, { ignoreCache: false });
  if (cookieCheck.status === 'EXPIRED') {
    console.error(`✗ Cookies expired: ${cookieCheck.reason}. Re-export from Chrome.`);
    process.exit(2);
  }
  log(`Cookie preflight: ${cookieCheck.status} — ${cookieCheck.reason}`);

  const cookies = JSON.parse(fs.readFileSync(COOKIES, 'utf8'));
  log(`Cookies: ${cookies.length}`);

  log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'shell',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
      '--single-process',
    ],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60_000);

  log('Setting cookies...');
  await page.goto('https://app.ayoa.com/', { waitUntil: 'domcontentloaded' });
  await page.setCookie(...cookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || '/',
    httpOnly: c.httpOnly || false,
    secure: c.secure || false,
    sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax'),
  })));

  log('Navigating to /mindmaps/new...');
  await page.goto('https://app.ayoa.com/mindmaps/new', { waitUntil: 'networkidle2', timeout: 60_000 });
  await sleep(5000);

  // Screenshot 1: page after /mindmaps/new
  await page.screenshot({ path: SCREENSHOT.replace('.png', '-1-new.png'), fullPage: true });
  log(`Screenshot 1: ${SCREENSHOT.replace('.png', '-1-new.png')}`);

  // Find and click "New Project" or "+" button
  log('Looking for "+" / "New Project" button...');
  const newProjectClicked = await page.evaluate(() => {
    const candidates = [
      ...document.querySelectorAll('button'),
      ...document.querySelectorAll('a'),
      ...document.querySelectorAll('[role="button"]'),
      ...document.querySelectorAll('[data-testid]'),
    ];
    for (const el of candidates) {
      const t = (el.textContent || '').toLowerCase();
      if (t.match(/new project|create new|^\\+$|^new$|^\\+\\s*$/)) {
        el.click();
        return { clicked: true, text: el.textContent.trim() };
      }
    }
    return { clicked: false };
  });
  log(`New Project click: ${JSON.stringify(newProjectClicked)}`);
  await sleep(2000);

  // Screenshot 2: after New Project click
  await page.screenshot({ path: SCREENSHOT.replace('.png', '-2-newproject.png'), fullPage: true });
  log(`Screenshot 2: ${SCREENSHOT.replace('.png', '-2-newproject.png')}`);

  // Find and click "Mind Map" option
  log('Looking for "Mind Map" option...');
  const mindmapClicked = await page.evaluate(() => {
    const candidates = [
      ...document.querySelectorAll('button'),
      ...document.querySelectorAll('a'),
      ...document.querySelectorAll('[role="button"]'),
      ...document.querySelectorAll('li'),
      ...document.querySelectorAll('[data-testid]'),
    ];
    for (const el of candidates) {
      const t = (el.textContent || '').trim().toLowerCase();
      if (t === 'mind map' || t.startsWith('mind map')) {
        el.click();
        return { clicked: true, text: el.textContent.trim() };
      }
    }
    return { clicked: false };
  });
  log(`Mind Map click: ${JSON.stringify(mindmapClicked)}`);
  await sleep(2000);

  // Screenshot 3: after Mind Map click
  await page.screenshot({ path: SCREENSHOT.replace('.png', '-3-mindmap.png'), fullPage: true });
  log(`Screenshot 3: ${SCREENSHOT.replace('.png', '-3-mindmap.png')}`);

  // Find "Import" button
  log('Looking for "Import" button...');
  const importClicked = await page.evaluate(() => {
    const candidates = [
      ...document.querySelectorAll('button'),
      ...document.querySelectorAll('a'),
      ...document.querySelectorAll('[role="button"]'),
      ...document.querySelectorAll('[data-testid]'),
    ];
    for (const el of candidates) {
      const t = (el.textContent || '').trim().toLowerCase();
      if (t === 'import' || t.includes('import')) {
        el.click();
        return { clicked: true, text: el.textContent.trim() };
      }
    }
    return { clicked: false };
  });
  log(`Import click: ${JSON.stringify(importClicked)}`);
  await sleep(2000);

  // Screenshot 4: after Import click
  await page.screenshot({ path: SCREENSHOT.replace('.png', '-4-import.png'), fullPage: true });
  log(`Screenshot 4: ${SCREENSHOT.replace('.png', '-4-import.png')}`);

  // Find the dropzone
  log('Looking for dropzone...');
  const dropzoneInfo = await page.evaluate(() => {
    const candidates = [
      document.querySelector('[class*="dropzone"]'),
      document.querySelector('[class*="drop-zone"]'),
      document.querySelector('[class*="upload"]'),
      document.querySelector('[data-testid*="drop"]'),
      document.querySelector('[data-testid*="upload"]'),
      document.querySelector('input[type="file"]'),
    ].filter(Boolean);
    const info = candidates.map((el) => ({
      tag: el.tagName,
      cls: el.className,
      testid: el.getAttribute('data-testid'),
      type: el.type || null,
    }));
    return { count: candidates.length, info };
  });
  log(`Dropzone: ${JSON.stringify(dropzoneInfo)}`);

  // Simulate file upload via input[type=file] or drop event
  log('Uploading file via DataTransfer drop event...');
  const dropResult = await page.evaluate(async (opmlText) => {
    // Find dropzone or input file
    let target = document.querySelector('[class*="dropzone"]')
              || document.querySelector('[class*="drop-zone"]')
              || document.querySelector('[class*="upload"]')
              || document.body;
    const fileInput = document.querySelector('input[type="file"]');

    // Create a File object from the OPML text
    const blob = new Blob([opmlText], { type: 'text/x-opml' });
    const file = new File([blob], 'waico-maco.opml', { type: 'text/x-opml' });

    const dt = new DataTransfer();
    dt.items.add(file);

    // Method 1: dispatch drop event on dropzone
    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt,
    });
    target.dispatchEvent(dropEvent);

    // Method 2: trigger file input change
    if (fileInput) {
      const fileList = dt.files;
      // DataTransfer.files is readonly but we can mutate via Object.defineProperty
      Object.defineProperty(fileInput, 'files', { value: fileList, writable: false });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, method: 'input', fileInputFound: true };
    }

    return { ok: true, method: 'drop', fileInputFound: false, targetTag: target.tagName };
  }, opmlContent);
  log(`Drop result: ${JSON.stringify(dropResult)}`);

  await sleep(5000);

  // Screenshot 5: after file upload
  await page.screenshot({ path: SCREENSHOT.replace('.png', '-5-uploaded.png'), fullPage: true });
  log(`Screenshot 5: ${SCREENSHOT.replace('.png', '-5-uploaded.png')}`);

  // Find "Import" button to confirm
  log('Looking for final "Import" button to confirm...');
  const confirmClicked = await page.evaluate(() => {
    const candidates = [
      ...document.querySelectorAll('button'),
      ...document.querySelectorAll('[role="button"]'),
    ];
    for (const el of candidates) {
      const t = (el.textContent || '').trim().toLowerCase();
      if (t === 'import' && !el.disabled) {
        el.click();
        return { clicked: true, text: el.textContent.trim() };
      }
    }
    return { clicked: false };
  });
  log(`Confirm click: ${JSON.stringify(confirmClicked)}`);

  await sleep(15000);

  // Screenshot 6: after import confirmation
  await page.screenshot({ path: SCREENSHOT, fullPage: true });
  log(`Final screenshot: ${SCREENSHOT}`);

  const url = page.url();
  log(`Final URL: ${url}`);

  // Extract mindmap ID
  const m = url.match(/\/mindmaps\/([0-9a-f-]+)/);
  const mindmapId = m ? m[1] : null;

  fs.writeFileSync(OUTPUT, JSON.stringify({
    ok: true,
    url,
    mindmapId,
    opml: OPML,
    screenshots: {
      new: SCREENSHOT.replace('.png', '-1-new.png'),
      newProject: SCREENSHOT.replace('.png', '-2-newproject.png'),
      mindmap: SCREENSHOT.replace('.png', '-3-mindmap.png'),
      import: SCREENSHOT.replace('.png', '-4-import.png'),
      uploaded: SCREENSHOT.replace('.png', '-5-uploaded.png'),
      final: SCREENSHOT,
    },
  }, null, 2));

  log(`Result saved: ${OUTPUT}`);
  await browser.close();
  log('Done.');
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', e.stack || e.message);
  process.exit(1);
});