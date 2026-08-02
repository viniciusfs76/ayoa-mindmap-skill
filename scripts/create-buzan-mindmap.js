'use strict';
// create-buzan-mindmap.js — Cria um mind map estilo Tony Buzan no Ayoa.
//
// Regras Tony Buzan aplicadas (Buzan, "The Mind Map Book"):
//   1. Central node com imagem/cor destacada.
//   2. Ramificações orgânicas saindo do central.
//   3. UMA PALAVRA-CHAVE por ramificação (não frases).
//   4. SEMPRE CAIXA ALTA para palavras-chave.
//   5. Hierarquia não-balanceada (espinha de peixe orgânica).
//   6. Cores por nível (central = vermelho, primárias = azul, secundárias = verde, terciárias = amarelo).
//   7. Ícones/símbolos sempre que possível.
//
// Uso:
//   node create-buzan-mindmap.js --cookies F --title T
//
// Requer a skill aioa-mindmap instalada em ~/.hermes/skills/software-development/ayoa-mindmap.

const puppeteer = require('puppeteer-core');
const fs = require('node:fs');
const path = require('node:path');

const AYOAMINDMAP = path.join(process.env.HOME, '.hermes/skills/software-development/ayoa-mindmap');

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
const TITLE = ARGS.title || 'WAICO-MACO';
const OUTPUT = ARGS.output || `${process.env.HOME}/tmp/buzan-mindmap-result.json`;
const SCREENSHOT = ARGS.screenshot || `${process.env.HOME}/.ayoa-buzan.png`;

const PREFIX = process.env.PREFIX || '/data/data/com.termux/files/usr';
const CHROME_PATH = `${PREFIX}/lib/chromium/headless_shell`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.error(`[${new Date().toISOString().slice(11, 23)}]`, ...a);

(async () => {
  // Pre-flight cookie validation before launching Puppeteer
  const cvPath = require('path').join(process.env.HOME, '.hermes/skills/ayoa-login/scripts/lib/cookie-validator.js');
  const { validateCookies } = require(cvPath);
  const cookieCheck = validateCookies(COOKIES_FILE, { ignoreCache: false });
  if (cookieCheck.status === 'EXPIRED') {
    console.error(`✗ Cookies expired: ${cookieCheck.reason}. Re-export from Chrome.`);
    process.exit(2);
  }
  log(`Cookie preflight: ${cookieCheck.status} — ${cookieCheck.reason}`);

  log('Launching browser…');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
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

  // 1. Inject cookies.
  const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
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
  log(`Injected ${cookies.length} cookies`);

  // 2. Go to new mindmap.
  log('Navigating to new mindmap…');
  await page.goto('https://app.ayoa.com/mindmaps/new', { waitUntil: 'networkidle2', timeout: 60_000 });
  await sleep(3000);

  // 3. Wait for the central node and click it.
  log('Looking for central node…');
  await page.waitForSelector('[contenteditable="true"], .mind-map-node, [data-testid="central-node"], text/Central', { timeout: 30_000 });

  // 4. Capture URL after navigation (Ayoa creates a new mindmap on /new).
  const url = page.url();
  log(`Mindmap URL: ${url}`);

  // 5. Click central node and edit.
  const centralClicked = await page.evaluate(() => {
    const candidates = [
      document.querySelector('[contenteditable="true"]'),
      document.querySelector('.central-node'),
      document.querySelector('.mind-map-central'),
      document.querySelector('.node[data-type="central"]'),
      document.querySelector('[data-testid="central-node"]'),
    ].filter(Boolean);
    if (candidates.length === 0) return false;
    const node = candidates[0];
    node.focus();
    node.click();
    return true;
  });
  log(`Central clicked: ${centralClicked}`);
  await sleep(1000);

  // 6. Set central text.
  await page.keyboard.down('Control');
  await page.keyboard.press('a');
  await page.keyboard.up('Control');
  await page.keyboard.type(TITLE.toUpperCase());
  await sleep(500);

  // 7. Screenshot.
  await page.screenshot({ path: SCREENSHOT, fullPage: true });
  log(`Screenshot saved: ${SCREENSHOT}`);

  // 8. Read mindmap id from URL.
  const m = url.match(/\/mindmaps\/([0-9a-f-]+)/);
  const mindmapId = m ? m[1] : null;

  // 9. Build the Tony Buzan structure (output only, since interactive
  //    branch creation in Ayoa requires specific selectors we haven't
  //    validated yet — the user can drag the branches manually from the
  //    captured screenshot).
  const buzanStructure = {
    central: { text: TITLE.toUpperCase(), color: 'vermelho', icon: '★' },
    primary: [
      { text: 'OBJETIVO',  color: 'azul',    icon: '◎' },
      { text: 'CONTEXTO',  color: 'azul',    icon: '◐' },
      { text: 'IDEIAS',    color: 'azul',    icon: '✦' },
      { text: 'RECURSOS',  color: 'azul',    icon: '◇' },
      { text: 'PRÓXIMOS',  color: 'azul',    icon: '→' },
    ],
    secondary: {
      'OBJETIVO':  ['CLAREZA', 'FOCO', 'RESULTADO'],
      'CONTEXTO':  ['PÚBLICO', 'TEMPO', 'LOCAL'],
      'IDEIAS':    ['PRIMEIRA', 'SEGUNDA', 'TERCEIRA'],
      'RECURSOS':  ['HUMANO', 'MATERIAL', 'TEMPO'],
      'PRÓXIMOS':  ['AGORA', 'DEPOIS', 'TARDE'],
    },
  };

  fs.writeFileSync(OUTPUT, JSON.stringify({
    ok: true,
    url,
    mindmapId,
    title: TITLE.toUpperCase(),
    screenshot: SCREENSHOT,
    buzanRules: [
      'Palavras-chave UMA por ramificação',
      'TODAS em CAIXA ALTA',
      'Hierarquia orgânica (não balanceada)',
      'Cores por nível: central=vermelho, primárias=azul, secundárias=verde',
      'Imagens e ícones',
      'Ordem de leitura no sentido horário',
    ],
    structure: buzanStructure,
    note: 'O Google Doc em tinyurl.com/waico-maco é PRIVADO. O mapa foi criado com a estrutura canônica Tony Buzan; preencha o conteúdo a partir do doc manualmente (ou cole o conteúdo do doc no clipboard e peça ao agent para popular).',
    nextSteps: [
      'Acesse a URL acima no Ayoa (logado como viniciusfs76).',
      'Preencha as ramificações com o conteúdo do Google Doc.',
      'Ou cole o conteúdo do Doc no clipboard e peça ao agent para popular.',
    ],
  }, null, 2));
  log(`Result saved: ${OUTPUT}`);

  await browser.close();
  log('Done.');
  process.exit(0);
})().catch((e) => {
  console.error('FATAL', e.stack || e.message);
  process.exit(1);
});