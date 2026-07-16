// ayoa-capture-slides.js — Capturar todos os slides como PNG
//
// Uso:
//   node ayoa-capture-slides.js --cookies <cookies.json> --target <url> [--output <dir>] [--from <n>] [--to <n>] [--wait <ms>]
//
// --from / --to: capturar apenas um intervalo de slides (útil para batches)
// --wait: tempo entre capturas (padrão 1200ms)

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
      if (val && !val.startsWith('--')) { args[key] = val; i++; }
      else { args[key] = true; }
    }
  }
  return args;
}

const ARGS = parseArgs();
const COOKIES_FILE = ARGS.cookies || (() => { throw new Error('--cookies required') })();
const TARGET = ARGS.target || (() => { throw new Error('--target required') })();
const OUTPUT_DIR = ARGS.output || `${process.env.HOME}/storage/downloads/presentation`;
const FROM = parseInt(ARGS.from) || 1;
const TO = ARGS.to ? parseInt(ARGS.to) : Infinity;
const WAIT_MS = parseInt(ARGS.wait) || 1200;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.error(`[${new Date().toISOString().slice(11,23)}]`, ...a);

(async () => {
  const login = require('./ayoa-login.js');
  const presenter = require('./ayoa-presenter.js');

  // Read cookies
  const raw = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
  const cookies = raw.map(c => ({
    name: c.name, value: c.value,
    domain: c.domain || '.ayoa.com',
    path: c.path || '/',
    httpOnly: c.httpOnly || false, secure: c.secure || false,
    sameSite: (c.sameSite || 'Lax').charAt(0).toUpperCase() + (c.sameSite || 'Lax').slice(1),
  }));

  // Launch and login
  const browser = await login.launchBrowser();
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  await page.setUserAgent('Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.182 Safari/537.36');

  await login.login(page, cookies);
  await login.navigateToMindmap(page, TARGET);

  // Open presenter and get slides
  const allSlides = await presenter.openPresenter(page);
  log(`Total slides: ${allSlides.length}`);

  // Create output dir
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Determine range
  const startIdx = Math.max(0, FROM - 1);
  const endIdx = Math.min(allSlides.length, TO === Infinity ? allSlides.length : TO);

  log(`Capturing slides ${startIdx + 1} to ${endIdx} of ${allSlides.length}`);

  // Capture each slide
  let captureFailures = 0;
  for (let i = startIdx; i < endIdx; i++) {
    const slide = allSlides[i];
    const slideNum = i + 1;

    // Navigate to slide via the present-mode path, then wait for the canvas
    // to settle on the right slide. This is the key change vs the old
    // navigateToSlide: previously the script took a screenshot of the
    // editor canvas before Ayoa had moved the presentation canvas to this
    // slide, producing duplicate or "stuck on slide 1" PNGs.
    const state = await presenter.goToSlideForCapture(page, slide.id, { timeout: 12000 });
    if (!state.settled) {
      captureFailures++;
      log(`Slide ${slideNum} — FAIL (${state.reason}, activeId=${state.activeId})`);
      // Re-enter present mode and try the Next-arrow path as a fallback.
      const recovered = await presenter.advanceToSlideViaNextArrow(page, slide.id, { timeout: 8000 });
      if (!recovered) {
        log(`Slide ${slideNum} — SKIP (recovery via Next arrow also failed)`);
        continue;
      }
    }

    await sleep(WAIT_MS);

    const filename = `slide-${String(slideNum).padStart(3, '0')}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);
    await page.screenshot({ path: filepath });

    if (slideNum % 25 === 0) {
      log(`Progress: ${slideNum}/${endIdx}`);
    }
  }

  log(`Capture complete: ${endIdx - startIdx} slides saved to ${OUTPUT_DIR}`);
  if (captureFailures > 0) {
    log(`WARNING: ${captureFailures} slide(s) required Next-arrow recovery; verify they match expected content.`);
  }

  // Verify
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.startsWith('slide-') && f.endsWith('.png'));
  log(`Total PNG files in output: ${files.length}`);

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
