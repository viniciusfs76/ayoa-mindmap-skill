'use strict';
// import-opml-v3.js — Import OPML no Ayoa via Puppeteer + Ayoa login flow.
//
// Uses the canonical `ayoa-login.js` flow (www.ayoa.com → cookies →
// app.ayoa.com) which avoids the `auth.ayoa.com/login` redirect bug that
// affected earlier versions of this script.
//
// Flow (matches the official UI flow per `references/ayoa-import-formats.md`):
//   1. Login via cookies (root domain → app subdomain).
//   2. Navigate to https://app.ayoa.com/mindmaps/new.
//   3. Click "+ / New Project" → opens modal.
//   4. Type map name → click first "Mind Map" tile → click OK.
//   5. Click "Import" button → drag-and-drop or select .opml file → click OK.
//   6. Wait for navigation to the new map URL.

const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const AYOAMINDMAP = path.join(process.env.HOME, '.hermes/skills/software-development/ayoa-mindmap');

// Inlined from aioa-login.js (avoids parseArgs side-effect on require).
// Path: www.ayoa.com → setCookie → app.ayoa.com — required for session
// resume; direct setCookie on app.ayoa.com redirects to auth.ayoa.com/login.
const PREFIX = process.env.PREFIX || '/data/data/com.termux/files/usr';
const CHROME_PATH = `${PREFIX}/lib/chromium/headless_shell`;
const ts = () => new Date().toISOString().slice(11, 23);
const log = (...a) => console.error(`[${ts()}]`, ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function launchBrowser() {
  log('Launching browser...');
  return puppeteer.launch({
    executablePath: CHROME_PATH, headless: 'shell',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process'],
    defaultViewport: { width: 1440, height: 900 },
  });
}

async function gotoWithRetry(page, url, options, { attempts = 2, backoff = 1500 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await page.goto(url, options);
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        log(`gotoWithRetry attempt ${i+1} failed: ${e.message}; retrying in ${backoff}ms`);
        await sleep(backoff);
      }
    }
  }
  throw lastErr;
}

async function login(page, cookies) {
  log('Navigating to www.ayoa.com...');
  await gotoWithRetry(page, 'https://www.ayoa.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  // Filter & normalise cookies for Puppeteer setCookie
  let injected = 0;
  for (const c of cookies) {
    try { await page.setCookie(c); injected++; }
    catch (e) { log(`Skipped cookie ${c.name}: ${e.message.split('\n')[0]}`); }
  }
  log(`Cookies injected: ${injected} of ${cookies.length}`);
  log('Navigating to app.ayoa.com...');
  await gotoWithRetry(page, 'https://app.ayoa.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  log('Session established at:', page.url());
  if (/^https:\/\/auth\.ayoa\.com\/login(?:\?|$)/i.test(page.url())) {
    throw new Error('Ayoa authentication failed: cookies expired or incomplete (redirected to auth.ayoa.com/login)');
  }
}

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
const OUTPUT = ARGS.output || `${process.env.HOME}/tmp/import-opml-v3.json`;
const SCREENSHOT = ARGS.screenshot || `${process.env.HOME}/.ayoa-import-v3.png`;
const MAP_NAME = ARGS.name || null; // null = use OPML <title> or first node text

(async () => {
  log('Reading OPML...');
  if (!fs.existsSync(OPML)) { console.error(`FATAL: OPML not found: ${OPML}`); process.exit(1); }
  const opmlContent = fs.readFileSync(OPML, 'utf8');
  log(`OPML: ${OPML} (${opmlContent.length} bytes)`);

  // Pre-flight cookie validation
  if (!fs.existsSync(COOKIES)) { console.error(`FATAL: cookies not found: ${COOKIES}`); process.exit(1); }
  const cvPath = require('path').join(process.env.HOME, '.hermes/skills/ayoa-login/scripts/lib/cookie-validator.js');
  const { validateCookies } = require(cvPath);
  const cookieCheck = validateCookies(COOKIES, { ignoreCache: false });
  if (cookieCheck.status === 'EXPIRED') {
    console.error(`✗ Cookies expired: ${cookieCheck.reason}. Re-export from Chrome.`);
    process.exit(2);
  }
  log(`Cookie preflight: ${cookieCheck.status} — ${cookieCheck.reason}`);

  const cookiesRaw = JSON.parse(fs.readFileSync(COOKIES, 'utf8'));

  // Map the Android-export cookies to the shape aioa-login expects.
  const cookies = cookiesRaw
    .filter(c => c.name && c.value && c.domain)
    .map(c => {
      let ss = (c.sameSite || 'Lax');
      if (ss === 'no_restriction') ss = 'None';
      if (!['Lax', 'Strict', 'None'].includes(ss.charAt(0).toUpperCase() + ss.slice(1))) ss = 'Lax';
      return {
        name: String(c.name),
        value: String(c.value),
        domain: c.domain.startsWith('.') ? c.domain : '.' + c.domain,
        path: String(c.path || '/'),
        httpOnly: Boolean(c.httpOnly),
        secure: Boolean(c.secure),
        sameSite: ss.charAt(0).toUpperCase() + ss.slice(1),
      };
    });
  log(`Cookies mapped: ${cookies.length} (after filter)`);

  const browser = await launchBrowser();
  const page = await browser.newPage();
  page.setDefaultTimeout(60_000);

  try {
    // Step 1-2: login (via the canonical aioa-login flow)
    await login(page, cookies);

    // Step 3: navigate to /mindmaps/new (not /mindmaps/<id> — we want a fresh map)
    log('Navigating to https://app.ayoa.com/mindmaps/new ...');
    await page.goto('https://app.ayoa.com/mindmaps/new', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(5000);
    await page.screenshot({ path: SCREENSHOT.replace('.png', '-1-new.png'), fullPage: true });

    // Step 4: dismiss HubSpot-style cookie banner (pre-condition for modal)
    const bannerDismissed = await page.evaluate(() => {
      const all = [...document.querySelectorAll('button, [role="button"]')];
      for (const el of all) {
        const t = (el.textContent || '').trim().toLowerCase();
        if (t === 'accept' || t === 'aceitar' || t.includes('aceitar todos') || t.includes('accept all') || t.includes('decline')) {
          try { el.click(); return true; } catch (_) {}
        }
      }
      return false;
    });
    log(`Step 4: cookie banner dismissed=${bannerDismissed}`);
    await sleep(2000);

    // Step 5: click "+" or "Novo projeto" or "New Project"
    let np = await page.evaluate(() => {
      const all = [...document.querySelectorAll('button, a, [role="button"], [aria-label]')];
      for (const el of all) {
        const t = el.textContent.trim();
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        if (t === '+' || t === '＋' || aria === 'new project' || aria === 'novo projeto') {
          try { el.click(); return { clicked: true, source: 'plus-or-aria' }; } catch (_) {}
        }
      }
      return { clicked: false };
    });
    if (!np.clicked) {
      np = await page.evaluate(() => {
        const all = [...document.querySelectorAll('button, a, [role="button"]')];
        for (const el of all) {
          const t = (el.textContent || '').toLowerCase();
          if (t.includes('novo projeto') || t.includes('new project') || t.includes('create new')) {
            try { el.click(); return { clicked: true, source: 'text' }; } catch (_) {}
          }
        }
        return { clicked: false };
      });
    }
    log(`Step 5: New Project click: ${JSON.stringify(np)}`);
    await sleep(3000);
    await page.screenshot({ path: SCREENSHOT.replace('.png', '-2-modal.png'), fullPage: true });

    // Step 6: type the map name into the modal
    const mapName = MAP_NAME || (function () {
      // Extract <title> from OPML
      const m = opmlContent.match(/<title>\s*([^<]+?)\s*<\/title>/);
      if (m) return m[1];
      // Fallback: first outline text
      const o = opmlContent.match(/<outline\s+text="([^"]+)"/);
      return o ? o[1] : 'Imported Map';
    })();
    log(`Step 6: typing map name "${mapName}"`);
    const typed = await page.evaluate((name) => {
      const inputs = document.querySelectorAll('input[type="text"], input:not([type]), textarea');
      for (const inp of inputs) {
        if (inp.offsetParent !== null || inp.type === 'text' || inp.tagName === 'TEXTAREA') {
          const proto = Object.getPrototypeOf(inp);
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(inp, name);
          else inp.value = name;
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      return false;
    }, mapName);
    log(`Step 6: typed=${typed}`);
    await sleep(800);

    // Step 7: click first "Mind Map" / "mapa mental" tile
    const mm = await page.evaluate(() => {
      const all = [...document.querySelectorAll('button, a, [role="button"], [class*="tile"], [class*="card"], [data-type]')];
      for (const el of all) {
        const t = (el.textContent || '').toLowerCase();
        if (t.includes('mind map') || t.includes('mapa mental')) {
          try { el.click(); return { clicked: true }; } catch (_) {}
        }
      }
      return { clicked: false };
    });
    log(`Step 7: Mind Map click: ${JSON.stringify(mm)}`);
    await sleep(800);

    // Step 8: click Criar / OK / Create / Confirm
    const ok = await page.evaluate(() => {
      const all = [...document.querySelectorAll('button, [role="button"], input[type="submit"]')];
      for (const el of all) {
        const t = (el.textContent || el.value || '').trim().toLowerCase();
        if (t === 'ok' || t === 'create' || t === 'criar' || t === 'confirm' || t === 'next' || t === 'save' || t === 'salvar') {
          try { el.click(); return { clicked: true }; } catch (_) {}
        }
      }
      return { clicked: false };
    });
    log(`Step 8: OK click: ${JSON.stringify(ok)}`);
    await sleep(8000); // wait for canvas to load
    await page.screenshot({ path: SCREENSHOT.replace('.png', '-3-after-create.png'), fullPage: true });

    // Step 9: wait for canvas to mount, then click Import (sidebar/topbar)
    let imp = { clicked: false };
    for (let attempt = 0; attempt < 3; attempt++) {
      imp = await page.evaluate(() => {
        const all = [...document.querySelectorAll('button, a, [role="button"], [class*="import"], [data-testid*="import"], [class*="Import"], span, div')];
        for (const el of all) {
          const t = (el.textContent || '').trim().toLowerCase();
          // Match "Import" / "Importar" exact, or as part of icon button with aria-label
          const aria = (el.getAttribute('aria-label') || '').toLowerCase();
          if ((t === 'import' || t === 'importar' || aria === 'import' || aria === 'importar') && el.offsetParent !== null) {
            try { el.click(); return { clicked: true, text: t || aria }; } catch (_) {}
          }
        }
        return { clicked: false };
      });
      if (imp.clicked) break;
      log(`Step 9 attempt ${attempt}: no Import button yet, waiting 3s...`);
      await sleep(3000);
    }
    log(`Step 9: Import click: ${JSON.stringify(imp)}`);
    await sleep(3000);

    // Step 10: upload OPML via input[type=file]
    const filename = (mapName || 'waico-maco').replace(/[^a-zA-Z0-9_-]/g, '_') + '.opml';
    const up = await page.evaluate(async (opmlText, fname) => {
      let input = document.querySelector('input[type="file"]');
      if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.style.display = 'none';
        document.body.appendChild(input);
      }
      const blob = new Blob([opmlText], { type: 'text/x-opml' });
      const file = new File([blob], fname, { type: 'text/x-opml' });
      const dt = new DataTransfer();
      dt.items.add(file);
      Object.defineProperty(input, 'files', { value: dt.files, writable: false });
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { uploaded: true, fileName: fname };
    }, opmlContent, filename);
    log(`Step 10: upload: ${JSON.stringify(up)}`);
    await sleep(3000);
    await page.screenshot({ path: SCREENSHOT.replace('.png', '-4-uploaded.png'), fullPage: true });

    // Step 11: click final Import / OK to confirm (after upload was processed)
    let cimp = { clicked: false };
    for (let attempt = 0; attempt < 5; attempt++) {
      cimp = await page.evaluate(() => {
        const all = [...document.querySelectorAll('button, [role="button"], a, div[class*="submit"], div[class*="confirm"]')];
        for (const el of all) {
          const t = (el.textContent || '').trim().toLowerCase();
          if ((t === 'import' || t === 'importar' || t === 'ok' || t === 'confirm' || t === 'upload' || t === 'next' || t === 'save' || t === 'salvar' || t.includes('import')) && el.offsetParent !== null && !el.disabled) {
            try { el.click(); return { clicked: true, text: t }; } catch (_) {}
          }
        }
        return { clicked: false };
      });
      if (cimp.clicked) break;
      log(`Step 11 attempt ${attempt}: no confirm button yet, waiting 2s...`);
      await sleep(2000);
    }
    log(`Step 11: confirm Import click: ${JSON.stringify(cimp)}`);
    await sleep(15000);
    await page.screenshot({ path: SCREENSHOT, fullPage: true });

    // Step 12: extract URL
    const url = page.url();
    const m = url.match(/\/mindmaps\/([0-9a-f-]+)/);
    const mindmapId = m ? m[1] : null;
    log(`Step 12: URL = ${url}, mindmapId = ${mindmapId}`);

    if (!mindmapId) {
      throw new Error(`Ayoa import failed: no mindmap ID in final URL (${url})`);
    }

    fs.writeFileSync(OUTPUT, JSON.stringify({
      ok: true,
      url,
      mindmapId,
      mapName,
      opml: OPML,
      steps: { bannerDismissed, newProject: np, typeName: { typed }, selectMindMap: mm, confirmCreate: ok, import: imp, upload: up, confirmImport: cimp },
    }, null, 2));
    log(`Result saved: ${OUTPUT}`);
  } catch (e) {
    log(`FATAL: ${e.stack || e.message}`);
    try { await page.screenshot({ path: SCREENSHOT.replace('.png', '-error.png'), fullPage: true }); } catch (_) {}
    fs.writeFileSync(OUTPUT, JSON.stringify({ ok: false, error: e.message, stack: e.stack }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
