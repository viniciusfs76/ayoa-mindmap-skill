// ayoa-pipeline.js — Pipeline completo: login → presenter → captura → vídeo
//
// Uso:
//   node ayoa-pipeline.js --cookies <cookies.json> --target <url> [--output <dir>]
//
// Flags:
//   --capture-from n   Iniciar captura do slide n (útil para retomar batches)
//   --capture-to n     Capturar até o slide n
//   --wait ms          Tempo entre capturas (padrão 1200)

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SKILL_SCRIPTS = __dirname;

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
const COOKIES = ARGS.cookies || (() => { throw new Error('--cookies required') })();
const TARGET = ARGS.target || (() => { throw new Error('--target required') })();
const OUTPUT = ARGS.output || `${process.env.HOME}/storage/downloads/presentation`;
const CAPTURE_FROM = ARGS['capture-from'];
const CAPTURE_TO = ARGS['capture-to'];
const WAIT = ARGS.wait || '1200';

const ts = () => new Date().toISOString().slice(11, 23);
const log = (...a) => console.error(`[${ts()}]`, ...a);

function runScript(name, extraArgs = [], timeout = 300000) {
  const scriptPath = path.join(SKILL_SCRIPTS, name);
  const args = ['--cookies', COOKIES, '--target', TARGET, '--output', OUTPUT, ...extraArgs];
  
  log(`▶ ${name} ${extraArgs.join(' ')}`);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: SKILL_SCRIPTS,
    encoding: 'utf8',
    timeout,
    env: { ...process.env },
  });
  
  if (result.status !== 0) {
    console.error(`  ✗ Exit code ${result.status}`);
    if (result.stderr) console.error('  stderr:', result.stderr.slice(-500));
    return false;
  }
  
  log(`  ✓ OK`);
  return true;
}

(async () => {
  log('=== Ayoa Pipeline ===');
  log(`Cookies: ${COOKIES}`);
  log(`Target:  ${TARGET}`);
  log(`Output:  ${OUTPUT}`);

  // Step 1: Login (quick test)
  if (!runScript('ayoa-login.js', [], 120000)) {
    log('✗ Login failed, aborting');
    process.exit(1);
  }

  // Step 2: Capture slides
  const captureArgs = ['--wait', WAIT];
  if (CAPTURE_FROM) captureArgs.push('--from', CAPTURE_FROM);
  if (CAPTURE_TO) captureArgs.push('--to', CAPTURE_TO);
  
  if (!runScript('ayoa-capture-slides.js', captureArgs, 600000)) {
    log('⚠ Capture had errors, continuing...');
  }

  // Step 3: Generate video
  runScript('ayoa-video.js', ['--input', OUTPUT], 300000);

  // Summary
  const files = fs.readdirSync(OUTPUT).filter(f => f.endsWith('.png'));
  const videos = fs.readdirSync(path.dirname(OUTPUT)).filter(f => f.endsWith('.mp4'));
  
  log('=== Pipeline Complete ===');
  log(`Slides: ${files.length} PNGs in ${OUTPUT}`);
  videos.forEach(v => {
    const stat = fs.statSync(path.join(path.dirname(OUTPUT), v));
    log(`Video: ${v} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`);
  });
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
