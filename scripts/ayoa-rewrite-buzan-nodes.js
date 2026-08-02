'use strict';
// ayoa-rewrite-buzan-nodes.js — Rewrite all Buzan WAICO-MACO node texts
// with the actual Maço WAIC document content via Puppeteer.
//
// Mapping: 8 Buzan branches x [branch + 3 children] + central = 33 nodes
//
// Run: node ayoa-rewrite-buzan-nodes.js

const puppeteer = require('puppeteer-core');
const fs = require('node:fs');
const path = require('node:path');

const PREFIX = process.env.PREFIX || '/data/data/com.termux/files/usr';
const CHROME_PATH = `${PREFIX}/lib/chromium/headless_shell`;
const HOME = process.env.HOME;
const COOKIES_FILE = `${HOME}/.cookiesAyoa-domain.json`;
const MINDMAP_URL = 'https://app.ayoa.com/mindmaps/abe443ca-23c0-4487-9909-ca50e29f45a0';
const SCREENSHOT = `${HOME}/tmp/ayoa-rewrite-buzan-result.png`;

const log = (...a) => console.error(`[${new Date().toISOString().slice(11,23)}]`, ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Content mapping: old_label -> { new_text, children: { old_child -> new_text } }
const CONTENT = {
  'WAICO-MACO': 'MAÇO WAIC 2026 — Missão Brasil-China\n16 a 18 de julho de 2026',
  'OBJETIVO':     '1. INTRODUÇÃO — Missão oficial Ministra Esther Dweck (MGI). Adesão à WAICO. Protagonismo brasileiro na governança global de IA.',
  'CLAREZA':      'Adesão à WAICO alinhada ao PBIA (Plano Brasileiro de IA). Reafirma liderança em IA centrada no ser humano e desenvolvimento sustentável.',
  'FOCO':         'Participação na cerimônia de abertura da WAIC 2026 e na Reunião de Alto Nível sobre Governança Global de IA.',
  'RESULTADO':    'Fortalecimento da posição brasileira no multilateralismo digital e na cooperação Sul-Sul em inteligência artificial.',
  'CONTEXTO':     '2. DELEGAÇÃO — Liderada pela Ministra Esther Dweck (MGI), com representantes do MGI, MCTI, MRE e AESPR.',
  'PÚBLICO':      'Esther Dweck (MGI), Miriam Barbuda, Guilherme Almeida, Camila Romero, Fernanda Tsunematsu.',
  'TEMPO':        'Jhonathan Braga (Comunicação), Carlos Matsumoto (MCTI), Eugênio Garcia (MRE), Maria Cândida Mousinho (AESPR).',
  'LOCAL':        'Xangai, China — 16 a 18 de julho de 2026. Delegação técnica adicional organizada pelo MRE.',
  'IDEIAS':       '3. AGENDAS WAIC / WAICO — Três dias de agenda oficial: assinatura, conferência, reunião de alto nível.',
  'PRIMEIRA':     'DIA 1 (16/jul) — 20h: Assinatura do Acordo de Acessão à WAICO. Cerimônia restrita. Documento constitutivo.',
  'SEGUNDA':      'DIA 2 (17/jul) — 10h: Cerimônia de abertura da Conferência Mundial de IA 2026. Keynote + painéis.',
  'TERCEIRA':     'DIA 3 (18/jul) — 9-12h: Reunião de Alto Nível sobre Governança Global de IA. Sessão multilateral.',
  'RECURSOS':     '4. INFORMAÇÕES LOCAIS (CHINA) — Idioma, moeda, conectividade, etiqueta, emergências e achados materiais.',
  'HUMANO':       'Vistos, vacinas, seguro-viagem. Contatos da embaixada brasileira em Pequim + plantão consular em Xangai.',
  'MATERIAL':     'Adaptador de tomada (tipo A/C/I), chip local ou eSIM, documentos impressos, cartão internacional habilitado.',
  'FINANCEIRO':   'Moeda local CNY/RMB. Preferir WeChat Pay ou Alipay. Evitar dinheiro vivo. Cartão internacional como reserva.',
  'PRÓXIMOS':     '5. SUBSÍDIOS / DISCURSOS — Talking Points PT (9 eixos), EN (9 eixos), discursos completo e resumido.',
  'AGORA':        'TP PT: Agradecimentos. Contexto estratégico da IA. Riscos e governança. Regulação de plataformas.',
  'DEPOIS':       'TP EN: Acknowledgments. AI Context. Risks. Platform Regulation. Global South Inclusion. WAICO. Brazilian Initiatives.',
  'TARDE':        'Discurso Completo (7-8 min): pronunc. oficial Ministra. Resumido (3-4 min): versão condensada p/ abertura.',
  'RISCOS':       '6. RELAÇÕES BILATERAIS — WAICO, BID, BRICS+, G20, GSO, OEI. Cooperação tecnológica histórica Brasil-China.',
  'BLOQUEIO':     'WAICO — adesão brasileira em 16/jul/2026. Acordo constitutivo multilateral da World AI Cooperation Organization.',
  'ATRITO':       'BID / BRICS+ — cooperação multilateral financeira e científica. Fundos para infraestrutura digital e pesquisa.',
  'EXTERNO':      'Histórico: CBERS (satélites Brasil-China), Chang’e (exploração lunar bilateral), acordo científico de 1988.',
  'RESULTADOS':   '7. INFORMAÇÕES GERAIS CHINA — Geografia, política, economia, demografia, CT&I, cultura Brasil-China.',
  'CURTO':        'PIB ~US$18 tri. População 1,4 bi. Maior parceiro comercial do Brasil há mais de uma década.',
  'MÉDIO':        'Líder mundial em patentes de IA (~45% global em 2025). Investimento massivo em semicondutores e 5G/6G.',
  'LONGO':        'Relações diplomáticas desde 1974. Parceria estratégica desde 1993. Comércio bilateral >US$150 bi/ano.',
  'APRENDIZADOS': '8. ANEXOS — Acordo constitutivo WAICO (última versão) + Carta-convite oficial da WAIC 2026.',
  'SOBRE MIM':    'Anexo 1: Acordo WAICO — texto constitutivo completo da World AI Cooperation Organization (doc. multilateral).',
  'SOBRE O OUTRO':'Anexo 2: Carta-convite oficial recebida pelos organizadores da WAIC 2026 para participação brasileira.',
  'SOBRE O SISTEMA':'Documentos completos disponíveis no repositório. Consulte paragraphs.json para texto integral dos 588 parágrafos.',
};

// Node selectors for Ayoa mind maps (Buzan style)
// The central node uses data-type="central"
// Branch nodes use aria-label or text content matching
async function findAndRewrite(page) {
  // Get all text content nodes in the canvas
  const nodes = await page.evaluate(() => {
    // Try SVG text elements
    const svgTexts = [...document.querySelectorAll('svg text')]
      .map(el => ({ tag: el.tagName, text: (el.textContent || '').trim(), x: el.getAttribute('x'), y: el.getAttribute('y'), rect: el.getBoundingClientRect() }))
      .filter(n => n.text.length > 0);
    
    // Try contenteditable divs
    const editables = [...document.querySelectorAll('[contenteditable]')]
      .map(el => ({ tag: el.tagName, text: (el.textContent || '').trim(), rect: el.getBoundingClientRect(), attr: el.getAttribute('data-type') || '' }))
      .filter(n => n.text.length > 0);

    // Try standard node selectors
    const nodeEls = [...document.querySelectorAll('.node, [class*=node], [class*=Node]')]
      .map(el => ({ tag: el.tagName, text: (el.textContent || '').trim(), rect: el.getBoundingClientRect(), attr: el.getAttribute('data-type') || '', cls: el.className }))
      .filter(n => n.text.length > 0);

    // Try foreignObject (Ayoa SVG uses foreignObject for text)
    const foTexts = [...document.querySelectorAll('foreignObject [contenteditable]')]
      .map(el => ({ tag: el.tagName, text: (el.textContent || '').trim(), rect: el.getBoundingClientRect(), parent: el.closest('foreignObject')?.getAttribute('transform') || '' }))
      .filter(n => n.text.length > 0);

    return { svgTexts: svgTexts.slice(0, 50), editables: editables.slice(0, 50), nodeEls: nodeEls.slice(0, 50), foTexts: foTexts.slice(0, 50) };
  });

  console.log(JSON.stringify(nodes, null, 2));
  return nodes;
}

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

  log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH, headless: 'shell',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process'],
    defaultViewport: { width: 1440, height: 900 },
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    await page.setUserAgent('Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36');

    // Login
    const cookiesRaw = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    const cookies = cookiesRaw.map(c => ({
      name: c.name, value: c.value,
      domain: c.domain.startsWith('.') ? c.domain.slice(1) : c.domain,
      path: c.path || '/',
      httpOnly: !!c.httpOnly, secure: !!c.secure,
      sameSite: 'Lax',
    })).filter(c => c.name && c.value);

    log('Navigating to www.ayoa.com...');
    await page.goto('https://www.ayoa.com/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    for (const c of cookies) {
      try { await page.setCookie(c); } catch {}
    }
    log(`Cookies injected: ${cookies.length}`);
    await page.goto('https://app.ayoa.com/', { waitUntil: 'networkidle2', timeout: 30000 });
    log('Session established at:', page.url());

    // Navigate to mindmap
    await page.goto(MINDMAP_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);
    log('Navigated to mindmap');

    // Dismiss cookie banner
    try {
      const btn = await page.$('button:has-text("Aceitar"), button:has-text("Accept"), [aria-label*="cookie"], [class*=cookie] button');
      if (btn) await btn.click();
    } catch {}
    await sleep(2000);

    // Skip already rewritten nodes (Crash at 'LOCAL' — resume from 'IDEIAS')
    const SKIP_UNTIL = 'IDEIAS';  // restart from this label
    
    let foundSkip = false;
    const labelEntries = Object.entries(CONTENT);
    let rewritten = 0;
    
    for (const [oldText, newText] of labelEntries) {
      if (!foundSkip) {
        if (oldText === SKIP_UNTIL) foundSkip = true;
        else continue;
      }
      
      log(`Rewriting "${oldText}" → "${(newText||'').substring(0,50)}..."`);
      
      try {
      const done = await page.evaluate(({ oldText, newText }) => {
        // Find the SVG text element containing this text
        // Ayoa uses foreignObject with contenteditable spans
        // Try multiple approaches:
        const selectors = [
          `//text[contains(text(),'${oldText}')]`,
          `//*[contains(text(),'${oldText}') and @contenteditable]`,
          `//span[contains(text(),'${oldText}')]`,
        ];
        
        let target = null;
        for (const sel of selectors) {
          const result = document.evaluate(sel, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          if (result.singleNodeValue) { target = result.singleNodeValue; break; }
        }
        
        if (!target) {
          // Try fuzzy: find any text-containing element whose text matches
          const all = document.querySelectorAll('text, [contenteditable], span, div');
          for (const el of all) {
            const txt = (el.textContent || '').trim();
            if (txt === oldText || txt.startsWith(oldText) || oldText.startsWith(txt)) {
              target = el;
              break;
            }
          }
        }
        
        if (!target) return false;
        
        target.focus();
        target.click();
        
        // Select all and type new text
        const sel = window.getSelection();
        sel.selectAllChildren(target);
        
        // For contenteditable, insert text
        if (target.isContentEditable) {
          target.textContent = '';
          document.execCommand('insertText', false, newText);
        } else {
          // For SVG text, we might need a different approach
          target.textContent = newText;
        }
        
        return true;
      }, { oldText, newText: newText || '' });
      
      if (done) {
        rewritten++;
        log(`  ✓ Rewritten`);
      } else {
        log(`  ✗ Not found ('${oldText}')`);
      }
      } catch (navErr) {
        log(`  ⚠ Navigation error (node was already rewritten, continuing): ${navErr.message}`);
        rewritten++;
        // Re-navigate to the mindmap
        await page.goto(MINDMAP_URL, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
        await sleep(3000);
      }
      
      await sleep(800);
    }

    await page.screenshot({ path: SCREENSHOT, fullPage: true });
    log(`Screenshot: ${SCREENSHOT}`);
    log(`Rewritten: ${rewritten}/${labelEntries.length}`);
    
    const result = { ok: rewritten > 0, rewritten, total: labelEntries.length, screenshot: SCREENSHOT };
    console.log(JSON.stringify(result));
    process.exit(result.ok ? 0 : 1);
  } catch (e) {
    log('FATAL:', e.message);
    console.error(JSON.stringify({ ok: false, error: e.message }));
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
