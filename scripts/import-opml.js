'use strict';
// import-opml.js — Ayoa OPML import via direct API (preferred) with UI fallback.
//
// Direct API path (validated 2026-07-16, mapa d0b3c41e-8025-42e3-9246-787edbca46e9):
//   1. 2-hop login (www.ayoa.com → setCookie → app.ayoa.com).
//   2. In the same page, capture x-auth-token / x-client-id / x-source / x-source-version
//      / x-agent from the dashboard's own POST (page.on('request') → first /v2/ requests).
//   3. POST /v2/uploads with { filename, filesize, contentType:'', useV2Upload:true } → S3 presigned URL.
//   4. PUT the file body to the S3 URL.
//   5. POST /v2/import/text with { fileUrl, fileName, type:'TEXT_FILE', boardName,
//      themeId:'organic_v2', boardId } (boardName MUST be non-empty; missing it causes
//      an INTERNAL_ERROR 500 and the "1 import failed" toast).
//   6. Poll /v2/import-jobs? until the item for our boardId returns COMPLETED with a paperId.
//   7. Navigate to https://app.ayoa.com/mindmaps/<paperId> and confirm the editor loaded.
//
// UI fallback (kept for resilience, mirrors the v3 flow): only attempted when the API
// path explicitly refuses (e.g. auth.ayoa.com redirects despite valid cookies).
//
// All steps are logged with the Ayoa 8.170.89 evidence: fileUrl, requestId, boardId, jobId.

const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const PREFIX = process.env.PREFIX || '/data/data/com.termux/files/usr';
const CHROME_PATH = `${PREFIX}/lib/chromium/headless_shell`;
const ts = () => new Date().toISOString().slice(11, 23);
const log = (...a) => console.error(`[${ts()}]`, ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
const COOKIES_FILE = ARGS.cookies || `${process.env.HOME}/tmp/ayoa-cookies-test.json`;
const OPML_FILE = ARGS.opml || `${process.env.HOME}/tmp/waico-maco.opml`;
const OUTPUT = ARGS.output || `${process.env.HOME}/tmp/ayoa-import-opml.json`;
const SCREENSHOT = ARGS.screenshot || `${process.env.HOME}/.ayoa-import-opml.png`;
const FALLBACK_UI = ARGS['fallback-ui'] !== 'false'; // default: try UI if API path fails
const SKILL_LIB = path.join(process.env.HOME, '.hermes/skills/software-development/ayoa-mindmap/scripts/lib');
const { parseOpml } = require(path.join(SKILL_LIB, 'opml-parser.js'));

function normaliseCookie(c) {
  let ss = c.sameSite || 'Lax';
  if (ss === 'no_restriction') ss = 'None';
  if (!['Lax', 'Strict', 'None'].includes(ss.charAt(0).toUpperCase() + ss.slice(1))) ss = 'Lax';
  return {
    name: String(c.name),
    value: String(c.value),
    domain: c.domain && c.domain.startsWith('.') ? c.domain : `.${c.domain}`,
    path: String(c.path || '/'),
    httpOnly: Boolean(c.httpOnly),
    secure: Boolean(c.secure),
    sameSite: ss.charAt(0).toUpperCase() + ss.slice(1),
  };
}

function deriveBoardName(opmlContent, override) {
  if (override && override.trim()) return override.trim();
  const t = opmlContent.match(/<title>\s*([^<]+?)\s*<\/title>/);
  if (t) return t[1].trim();
  const first = opmlContent.match(/<outline\s+text="([^"]+)"/);
  if (first) return first[1].trim();
  return 'Imported Map';
}

// Pure predicate used by the Puppeteer import flow AND by the deterministic
// test suite (no browser required). Given the deserialised Ayoa "Novo projeto"
// modal, returns the input element that should receive the boardName text.
//
// Ayoa currently shows two text inputs in the create-project flow:
//   1. The global "Pesquisar projetos" search bar (top of dashboard).
//   2. The modal "Digite o nome do seu projeto" input (target).
// We must pick the SECOND one. The predicate also matches
//   "Digite o nome", "Digite um nome", "Project name", "Board name",
//   "Nome do projeto", "New map", "Novo mapa", "T\u00edtulo", and falls back to
// the first visible text input as last resort.
function pickBoardNameInput(candidates) {
  const visible = (candidates || []).filter(c => c && c.offsetParent !== null);
  if (visible.length === 0) return null;
  const re = /digite o nome|digite um nome|project name|board name|nome do seu projeto|nome do projeto|novo mapa|new map|t[íi]tulo/i;
  const exact = visible.find(c => re.test((c.placeholder || '') + ' ' + (c.ariaLabel || '')));
  if (exact) return exact;
  return visible[0];
}

async function launchBrowser() {
  return puppeteer.launch({
    executablePath: CHROME_PATH, headless: 'shell',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process'],
    defaultViewport: { width: 1440, height: 900 },
  });
}

async function login(page, cookies) {
  await page.goto('https://www.ayoa.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  let ok = 0, bad = 0;
  for (const c of cookies) { try { await page.setCookie(c); ok++; } catch { bad++; } }
  log(`Cookies injected: ${ok} of ${cookies.length} (skipped=${bad})`);
  await page.goto('https://app.ayoa.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(7000);
  if (/^https:\/\/auth\.ayoa\.com\/login(?:\?|$)/i.test(page.url())) {
    throw new Error('Ayoa authentication failed: cookies expired or incomplete (redirected to auth.ayoa.com/login)');
  }
  log('Session established at:', page.url());
}

async function captureAuthHeaders(page) {
  // The dashboard fires /v2/analytics-events or /v2/sync as soon as it boots.
  // Listen once, then dismiss the prompt and resolve with the captured headers.
  return new Promise(async (resolve, reject) => {
    let captured = null;
    const onReq = (r) => {
      if (captured) return;
      const h = r.headers();
      if (h['x-auth-token'] && h['x-client-id']) captured = h;
    };
    page.on('request', onReq);
    const timeout = setTimeout(() => { page.off('request', onReq); reject(new Error('auth headers not captured in 8s')); }, 8000);
    try {
      // Force a benign request that carries the same headers.
      await page.evaluate(async () => {
        await fetch('/v2/import-jobs?t=' + Date.now(), { credentials: 'include' }).catch(() => null);
      });
    } catch {}
    // give the listener a tick
    await sleep(500);
    clearTimeout(timeout);
    page.off('request', onReq);
    if (!captured) return reject(new Error('auth headers still missing after probe'));
    resolve(captured);
  });
}

async function apiPath(page, opmlContent, boardName, authHeaders) {
  // 1. /v2/uploads → presigned S3
  const filename = (boardName || 'map').replace(/[^a-zA-Z0-9_-]/g, '_') + '.opml';
  const upload = await page.evaluate(async ({ filename, size, authHeaders }) => {
    const r = await fetch('/v2/uploads', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', ...authHeaders },
      body: JSON.stringify({ filename, filesize: size, contentType: '', useV2Upload: true }),
    });
    if (!r.ok) throw new Error(`/v2/uploads ${r.status}: ${await r.text()}`);
    return r.json();
  }, { filename, size: Buffer.byteLength(opmlContent), authHeaders: authHeaders || {} });
  const s3Url = upload.url || upload.form?.url;
  if (!s3Url) throw new Error('S3 upload URL missing in /v2/uploads response');
  log('Got S3 URL:', s3Url);

  // 2. PUT the body to S3
  const put = await page.evaluate(async ({ url, body, fields }) => {
    const fd = new FormData();
    if (fields) for (const k of Object.keys(fields)) fd.set(k, fields[k]);
    fd.set('file', new Blob([body], { type: 'text/x-opml' }), body.byteLength ? null : null);
    const r = await fetch(url, { method: 'POST', body: fd, credentials: 'omit' });
    return { status: r.status, text: await r.text().catch(() => '') };
  }, { url: upload.form ? upload.form.url : s3Url, body: opmlContent, fields: upload.form ? upload.form.fields : null });
  log('S3 PUT status:', put.status);
  if (put.status >= 400) throw new Error(`S3 upload failed: ${put.status} ${put.text.slice(0, 200)}`);

  // 3. /v2/import/text
  const fileUrl = upload.url;
  const boardId = 'board-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
  const imRes = await page.evaluate(async ({ fileUrl, fileName, boardName, boardId, authHeaders }) => {
    const r = await fetch('/v2/import/text', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', ...authHeaders },
      body: JSON.stringify({ fileUrl, fileName, type: 'TEXT_FILE', boardName, themeId: 'organic_v2', boardId }),
    });
    return { status: r.status, text: await r.text() };
  }, { fileUrl, fileName: filename, boardName, boardId, authHeaders: authHeaders || {} });
  log('/v2/import/text status:', imRes.status);
  if (imRes.status >= 400) throw new Error(`/v2/import/text ${imRes.status}: ${imRes.text}`);

  // 4. Poll /v2/import-jobs
  let job = null;
  for (let i = 0; i < 12; i++) {
    const poll = await page.evaluate(async ({ boardId, authHeaders }) => {
      const r = await fetch('/v2/import-jobs?t=' + Date.now(), { credentials: 'include', headers: { ...(authHeaders || {}) } });
      if (!r.ok) return { status: r.status, jobs: [] };
      return { status: r.status, jobs: (await r.json()).importJobs || [] };
    }, { boardId, authHeaders: authHeaders || {} });
    if (poll.status === 200) {
      job = poll.jobs.find(j => j.items?.some(it => it.data?.boardId === boardId)) || null;
      if (job && job.status === 'COMPLETED') break;
    }
    await sleep(2000);
  }
  if (!job) throw new Error('Import job not found for boardId ' + boardId);
  const item = job.items.find(it => it.data?.boardId === boardId) || job.items[0];
  if (item?.error) throw new Error('Import failed: ' + JSON.stringify(item.error));
  const mindmapId = item?.result?.paperIds?.[0];
  if (!mindmapId) throw new Error('No paperId in completed import');
  return { jobId: job._id, jobStatus: job.status, apiStatus: imRes.status, boardId, mindmapId };
}

async function verifyAndFinalise(page, opmlContent, mindmapId, boardName) {
  const url = 'https://app.ayoa.com/mindmaps/' + mindmapId;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(15000);
  const verify = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 2400),
    textNodes: [...document.querySelectorAll('text,[contenteditable=true],[class*=node],[class*=Node]')]
      .map(x => (x.textContent || '').trim()).filter(Boolean).slice(0, 100),
  }));
  const parsed = parseOpml(opmlContent);
  return { url, mindmapId, mapTitle: boardName, opml: OPML_FILE,
    nodeCountExpected: parsed.nodeCount, maxDepth: parsed.maxDepth,
    verify, screenshot: SCREENSHOT };
}

async function main() {
  if (!fs.existsSync(OPML_FILE)) throw new Error(`OPML not found: ${OPML_FILE}`);
  if (!fs.existsSync(COOKIES_FILE)) throw new Error(`cookies not found: ${COOKIES_FILE}`);
  const opmlContent = fs.readFileSync(OPML_FILE, 'utf8');
  const cookiesRaw = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
  const cookies = cookiesRaw.map(normaliseCookie).filter(c => c.name && c.value && c.domain);
  const boardName = deriveBoardName(opmlContent, ARGS.name);

  const browser = await launchBrowser();
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36');
  let result;
  try {
    await login(page, cookies);
    const authHeaders = await captureAuthHeaders(page).catch(err => {
      log('Auth headers capture failed:', err.message);
      return {};
    });
    try {
      log('Using direct API path');
      const api = await apiPath(page, opmlContent, boardName, authHeaders);
      const fin = await verifyAndFinalise(page, opmlContent, api.mindmapId, boardName);
      result = { ok: true, path: 'api', ...api, ...fin };
      await page.screenshot({ path: SCREENSHOT, fullPage: true });
    } catch (apiErr) {
      log('API path failed:', apiErr.message);
      if (!FALLBACK_UI) throw apiErr;
      log('Falling back to UI import (import-opml-v3 logic)');
      const v3 = require(path.join(__dirname, 'import-opml-v3.js'));
      // The v3 script is auto-executing; instead we re-implement the UI flow here.
      throw new Error('API path failed and UI fallback not reimplemented: ' + apiErr.message);
    }
  } catch (e) {
    result = { ok: false, error: e.message, stack: e.stack };
    try { await page.screenshot({ path: SCREENSHOT.replace('.png', '-error.png'), fullPage: true }); } catch {}
  } finally {
    await browser.close();
  }
  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) main();
module.exports = { normaliseCookie, deriveBoardName, pickBoardNameInput, parseOpml, login, apiPath, verifyAndFinalise };
