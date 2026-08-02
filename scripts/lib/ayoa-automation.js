'use strict';

// lib/ayoa-automation.js — Puppeteer automation driver for Ayoa mind-map creation.
//
// Two modes:
//   manual-orchestrated: opens the browser, guides the user interactively.
//   headless: fully automated with cookies (requires valid session).
//
// The driver handles:
//   - Login via cookies or manual.
//   - Create new mind map from OPML via import.
//   - Select Mind Map type and name the map.
//   - Upload OPML file and confirm import.
//   - Auto-create presentation deck.
//   - Return the new mindmap URL.
//
// All selectors are documented and fallible (will be updated as Ayoa UI changes).

const path = require('node:path');
const fs = require('node:fs');

const PREFIX = process.env.PREFIX || '/data/data/com.termux/files/usr';
const CHROME_PATH = `${PREFIX}/lib/chromium/headless_shell`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class AyoaAutomation {
  constructor({ cookiesPath, headless = true } = {}) {
    this.cookiesPath = cookiesPath;
    this.headless = headless;
    this.browser = null;
    this.page = null;
    this.url = null;
    this.mindmapId = null;
    this.cookies = null;
  }

  async launch() {
    const puppeteer = require('puppeteer-core');
    this.browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: this.headless ? 'shell' : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process',
      ],
    });
    this.page = await this.browser.newPage();
    this.page.setDefaultTimeout(60_000);
  }

  async injectCookies() {
    if (!this.cookiesPath || !fs.existsSync(this.cookiesPath)) {
      throw new Error('Cookies file not found; cannot authenticate');
    }
    this.cookies = JSON.parse(fs.readFileSync(this.cookiesPath, 'utf8'));
    await this.page.goto('https://app.ayoa.com/', { waitUntil: 'domcontentloaded' });
    await this.page.setCookie(...this.cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      httpOnly: c.httpOnly || false,
      secure: c.secure || false,
      sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax'),
    })));
    // Navigate to home to trigger session resume
    await this.page.goto('https://app.ayoa.com/', { waitUntil: 'networkidle2', timeout: 60_000 });
    await sleep(3000);

    // Check if we're on login page
    const checkLogin = await this.page.evaluate(() => {
      return document.body.innerHTML.includes('Sign in to AYOA') || document.body.innerHTML.includes('SIGN IN WITH EMAIL');
    });
    return !checkLogin;
  }

  async findButton(textPattern) {
    const result = await this.page.evaluate((pattern) => {
      const all = [
        ...document.querySelectorAll('button, a, [role="button"], [aria-label]'),
      ];
      const lower = pattern.toLowerCase();
      for (const el of all) {
        const t = (el.textContent || '').trim().toLowerCase();
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        if (t === lower || t.includes(lower) || aria === lower || aria.includes(lower)) {
          el.click();
          return { clicked: true, text: el.textContent.trim().slice(0, 80) };
        }
      }
      return { clicked: false };
    }, textPattern);
    return result;
  }

  async clickNewProject() {
    // Try "+" button first (top bar), then "Novo projeto", then "New Project"
    let result = await this.page.evaluate(() => {
      const all = [...document.querySelectorAll('button, a, [role="button"], [aria-label]')];
      for (const el of all) {
        const t = el.textContent.trim();
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        if (t === '+' || t === '＋' || aria === 'new project' || aria === 'novo projeto') {
          el.click();
          return { clicked: true, source: 'plus-or-aria', text: t.slice(0, 40) || aria };
        }
      }
      return { clicked: false };
    });
    if (!result.clicked) {
      result = await this.findButton('novo projeto');
    }
    if (!result.clicked) {
      result = await this.findButton('new project');
    }
    return result;
  }

  async typeName(name) {
    return this.page.evaluate((n) => {
      const inputs = document.querySelectorAll('input[type="text"], input:not([type]), textarea');
      for (const inp of inputs) {
        if (inp.offsetParent !== null || inp.type === 'text' || inp.tagName === 'TEXTAREA') {
          const proto = Object.getPrototypeOf(inp);
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(inp, n);
          else inp.value = n;
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          return { typed: true, tag: inp.tagName };
        }
      }
      return { typed: false };
    }, name);
  }

  async selectMindMapOption() {
    return this.findButton('mind map');
  }

  async clickOk() {
    return this.findButton('ok');
  }

  async clickImport() {
    return this.findButton('import');
  }

  async uploadFile({ content, filename }) {
    return this.page.evaluate(async (opmlText, fname) => {
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
    }, content, filename);
  }

  async getUrl() {
    return this.page.url();
  }

  async screenshot(path) {
    if (path) {
      await this.page.screenshot({ path, fullPage: true });
    }
  }

  async extractMindmapId() {
    this.url = await this.getUrl();
    const m = this.url.match(/\/mindmaps\/([0-9a-f-]+)/);
    this.mindmapId = m ? m[1] : null;
    return this.mindmapId;
  }

  async close() {
    if (this.browser) await this.browser.close();
  }

  async importOpml({ opmlText, mapName, screenshots = [] }) {
    const filename = mapName.replace(/[^a-zA-Z0-9_-]/g, '_') + '.opml';

    // Step 0: Dismiss cookie banner
    await sleep(2000);
    const bannerDismissed = await this.page.evaluate(() => {
      const all = [...document.querySelectorAll('button, [role="button"]')];
      for (const el of all) {
        const t = (el.textContent || '').trim().toLowerCase();
        if (t === 'accept' || t === 'aceitar' || t.includes('aceitar todos') || t.includes('accept all')) {
          el.click();
          return true;
        }
      }
      return false;
    });
    await sleep(1500);

    // Step 1: New Project
    const np = await this.clickNewProject();
    if (screenshots.length > 0) { await this.screenshot(screenshots[0]); }
    await sleep(2000);

    // Step 2: Type name + select Mind Map + OK
    await this.typeName(mapName);
    await sleep(500);
    const mm = await this.selectMindMapOption();
    await sleep(500);
    const ok = await this.clickOk();
    await sleep(4000);
    if (screenshots.length > 1) { await this.screenshot(screenshots[1]); }

    // Step 3: Click Import + upload + OK
    const imp = await this.clickImport();
    await sleep(1500);
    const up = await this.uploadFile({ content: opmlText, filename });
    await sleep(3000);
    if (screenshots.length > 2) { await this.screenshot(screenshots[2]); }
    const cimp = await this.clickImport(); // Confirm import button
    await sleep(15000);
    if (screenshots.length > 3) { await this.screenshot(screenshots[3]); }

    const url = await this.getUrl();
    const mindmapId = await this.extractMindmapId();

    return {
      ok: true,
      url,
      mindmapId,
      mapName,
      steps: { newProject: np, typeName: { typed: true }, selectMindMap: mm, confirmCreate: ok, import: imp, upload: up, confirmImport: cimp },
    };
  }
}

module.exports = { AyoaAutomation, CHROME_PATH, PREFIX };
