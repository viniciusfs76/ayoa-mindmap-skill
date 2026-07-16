// ayoa-login.js — Login no Ayoa por cookies e navegação ao mindmap
//
// Uso:
//   node ayoa-login.js --cookies <cookies.json> --target <url> [--output <dir>]
//
// Cookies: formato EditThisCookie (JSON array)
// Target: URL do mindmap ex: https://app.ayoa.com/mindmaps/<uuid>
// Output: opcional, padrão ~/storage/downloads/presentation

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const PREFIX = process.env.PREFIX || '/data/data/com.termux/files/usr';
const CHROME_PATH = `${PREFIX}/lib/chromium/headless_shell`;

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i].startsWith('--')) {
      const key = process.argv[i].slice(2);
      const val = process.argv[i + 1];
      if (val && !val.startsWith('--')) {
        args[key] = val;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

const ARGS = parseArgs();

const COOKIES = ARGS.cookies || (() => { throw new Error('--cookies required') })();
const TARGET = ARGS.target || (() => { throw new Error('--target required') })();
const OUTPUT_DIR = ARGS.output || `${process.env.HOME}/storage/downloads/presentation`;

const ts = () => new Date().toISOString().slice(11, 23);
const log = (...a) => console.error(`[${ts()}]`, ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function launchBrowser() {
  log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'shell',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--no-zygote', '--single-process',
    ],
    defaultViewport: { width: 1440, height: 900 },
  });
  return browser;
}

async function gotoWithRetry(page, url, options, { attempts = 2, backoff = 1500 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await page.goto(url, options);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      log(`Navigation to ${url} failed (${error.message}); retrying ${attempt + 1}/${attempts}...`);
      await sleep(backoff * attempt);
    }
  }
  throw lastError;
}

async function login(page, cookies) {
  // Step 1: navigate to root domain (required before setCookie)
  log('Navigating to www.ayoa.com...');
  await gotoWithRetry(page, 'https://www.ayoa.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });

  // Step 2: inject cookies (individually so a single bad cookie doesn't abort)
  let injected = 0;
  for (const c of cookies) {
    try {
      await page.setCookie(c);
      injected++;
    } catch (e) {
      log(`Skipped cookie ${c.name}: ${e.message.split('\n')[0]}`);
    }
  }
  log(`Injected ${injected} of ${cookies.length} cookies`);
  
  // Step 3: navigate to app subdomain to establish session. Ayoa occasionally
  // stalls on the first SPA bootstrap even though the second attempt succeeds.
  await gotoWithRetry(page, 'https://app.ayoa.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  log('Session established at:', page.url());
}

async function navigateToMindmap(page, url, { initialWait = 8000, pollInterval = 1000, readyTimeout = 40000 } = {}) {
  log('Navigating to mindmap:', url);
  const resp = await gotoWithRetry(page, url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  log('HTTP status:', resp.status());
  
  // Ayoa readiness is content-driven, not time-driven. Keep polling until the
  // localized Loading screen disappears and the editor toolbar/presenter mounts.
  if (initialWait) await sleep(initialWait);
  const deadline = Date.now() + readyTimeout;
  let ready = false;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      const loading = /(?:Carregando|Loading)(?:…|\.\.\.)?/i.test(text);
      const editor = Boolean(
        document.querySelector('.toggle-presenter') ||
        document.querySelector('.slides-list-container') ||
        document.querySelector('.sub-header-content-wrapper') ||
        document.querySelector('svg .node, .node.mainidea, .project-board-item')
      );
      return { loading, editor };
    });
    if (!state.loading && state.editor) { ready = true; break; }
    await sleep(pollInterval);
  }
  if (!ready) {
    throw new Error(`Ayoa mind map did not finish loading within ${readyTimeout}ms`);
  }
  
  // Dismiss cookie banner. Detached/animated overlays can make ElementHandle.click
  // fail; dispatch a DOM click as a verified fallback.
  const acceptBtn = await page.$('button[aria-label="Accept"]');
  if (acceptBtn) {
    try {
      await acceptBtn.click();
    } catch (error) {
      const dismissed = await page.evaluate(() => {
        const button = document.querySelector('button[aria-label="Accept"]');
        if (!button) return false;
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return true;
      });
      if (!dismissed) throw error;
    }
    log('Cookie banner dismissed');
    await sleep(1000);
  }
  
  return page.url();
}

// Export for use by other scripts
module.exports = {
  launchBrowser,
  login,
  gotoWithRetry,
  navigateToMindmap,
  parseArgs,
  CHROME_PATH,
  sleep,
  log,
};

// Main (when run directly)
if (require.main === module) {
  (async () => {
    const cookies = JSON.parse(fs.readFileSync(COOKIES, 'utf-8')).map(c => ({
      name: c.name, value: c.value,
      domain: c.domain || '.ayoa.com',
      path: c.path || '/',
      httpOnly: c.httpOnly || false,
      secure: c.secure || false,
      sameSite: (c.sameSite || 'Lax').charAt(0).toUpperCase() + (c.sameSite || 'Lax').slice(1),
    }));

    const browser = await launchBrowser();
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);
    await page.setUserAgent('Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.182 Safari/537.36');

    await login(page, cookies);
    const finalUrl = await navigateToMindmap(page, TARGET);
    log('Mindmap loaded:', finalUrl);

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    await page.screenshot({ path: path.join(OUTPUT_DIR, 'login-verified.png') });
    log('Login verified, screenshot saved');

    await browser.close();
    log('Done');
  })().catch(e => { console.error('FATAL:', e); process.exit(1); });
}
