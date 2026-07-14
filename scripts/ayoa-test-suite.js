// ayoa-test-suite.js — Suite completa de testes para a skill Ayoa Mindmap
//
// Uso:
//   node ayoa-test-suite.js [--cookies <cookies.json>] [--target <mindmap-url>] [--test <name>]
//
// Testes: test-login, test-present-mode, test-presenter, test-capture, test-video, test-all (padrão)
// NOTA: test-all executa cada teste em sequência isolada. Em dispositivos móveis
// com RAM limitada, pode falhar por contenção de recursos. Execute testes individuais
// para diagnóstico: node ayoa-test-suite.js --test test-capture

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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
const COOKIES = ARGS.cookies || `${process.env.HOME}/tmp/ayoa-cookies-raw.txt`;
const TARGET = ARGS.target || 'https://app.ayoa.com/mindmaps/481a39ca-d575-407d-b3ef-2a0a5331e8d9';
const TEST_NAME = ARGS.test || 'all';

const SKILL_DIR = path.resolve(__dirname);
const TMP_DIR = `${process.env.HOME}/tmp/ayoa-test-${Date.now()}`;
const TMP_OUTPUT = `${TMP_DIR}/slides`;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.log(`  ✗ ${message}`); failed++; }
}

function runScript(name, extraArgs = [], opts = {}) {
  const scriptPath = path.join(SKILL_DIR, name);
  const result = spawnSync(process.execPath, [scriptPath, ...extraArgs], {
    cwd: SKILL_DIR,
    encoding: 'utf8',
    timeout: opts.timeout || 120000,
    env: { ...process.env },
  });
  return result;
}

async function runTests() {
  console.log(`\n🧪 Ayoa Mindmap Test Suite`);
  console.log(`   Cookies: ${COOKIES}`);
  console.log(`   Target: ${TARGET}`);
  console.log(`   Test:    ${TEST_NAME}\n`);

  // Kill stale Chromium before any browser test
  const pkill = () => { try { spawnSync('pkill', ['-f', 'headless_shell'], { timeout: 3000 }); } catch {} };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  if (TEST_NAME === 'test-login' || TEST_NAME === 'test-all') {
    console.log('─── test: Login ───');
    pkill(); await sleep(2000);
    fs.mkdirSync(TMP_OUTPUT, { recursive: true });
    const r = runScript('ayoa-login.js', [
      '--cookies', COOKIES, '--target', TARGET, '--output', TMP_OUTPUT
    ], { timeout: 120000 });
    assert(r.status === 0, `ayoa-login.js exits with code ${r.status}`);
    if (r.status !== 0) console.error('  stderr:', (r.stderr || '').slice(-500));
    else {
      assert(!(r.stderr || '').includes('FATAL:'), 'No fatal errors');
      assert(fs.existsSync(path.join(TMP_OUTPUT, 'login-verified.png')), 'login-verified.png created');
    }
  }

  if (TEST_NAME === 'test-present-mode' || TEST_NAME === 'test-all') {
    console.log('\n─── test: Present mode contract ───');
    pkill(); await sleep(1000);
    const r = spawnSync(process.execPath, [
      '--test',
      path.join(SKILL_DIR, 'ayoa-login.test.js'),
      path.join(SKILL_DIR, 'ayoa-navigation.test.js'),
      path.join(SKILL_DIR, 'ayoa-readiness.test.js'),
      path.join(SKILL_DIR, 'ayoa-present-mode.test.js'),
      path.join(SKILL_DIR, 'ayoa-present-anti-regression.test.js'),
      path.join(SKILL_DIR, 'ayoa-present-fallback.test.js'),
      path.join(SKILL_DIR, 'ayoa-present-transitions.test.js'),
      path.join(SKILL_DIR, 'ayoa-present-source-rotation.test.js'),
      path.join(SKILL_DIR, 'ayoa-present-edge-cases.test.js'),
      path.join(SKILL_DIR, 'ayoa-present-i18n.test.js'),
      path.join(SKILL_DIR, 'ayoa-present-states.test.js'),
      path.join(SKILL_DIR, 'ayoa-present-recovery.test.js'),
      path.join(SKILL_DIR, 'ayoa-present-flicker.test.js'),
      path.join(SKILL_DIR, 'ayoa-present-presentation-id.test.js'),
      path.join(SKILL_DIR, 'ayoa-present-aria.test.js'),
      path.join(SKILL_DIR, 'ayoa-present-driver.test.js'),
    ], {
      cwd: SKILL_DIR,
      encoding: 'utf8',
      timeout: 240000,
      env: { ...process.env },
    });
    assert(r.status === 0, `Present mode contract tests exit with code ${r.status}`);
    if (r.status !== 0) console.error('  stderr:', (r.stderr || '').slice(-1000), '\n  stdout:', (r.stdout || '').slice(-1000));
    else {
      const m = (r.stdout || '').match(/pass (\d+)/);
      const passed = m ? parseInt(m[1], 10) : 0;
      assert(passed >= 178, `at least 178 deterministic Present mode regressions passed, got "${passed}"`);
    }
  }

  if (TEST_NAME === 'test-presenter' || TEST_NAME === 'test-all') {
    console.log('\n─── test: Presenter ───');
    pkill(); await sleep(2000);
    fs.mkdirSync(TMP_OUTPUT, { recursive: true });
    const r = runScript('ayoa-presenter.js', [
      '--cookies', COOKIES, '--target', TARGET, '--mode', 'list'
    ], { timeout: 120000 });
    assert(r.status === 0, `ayoa-presenter.js exits with code ${r.status}`);
    if (r.status !== 0) console.error('  stderr:', (r.stderr || '').slice(-500), '\n  stdout:', (r.stdout || '').slice(-200));
    if (r.status === 0) {
      try {
        const output = JSON.parse(r.stdout);
        assert(output.length > 0, `Found ${output.length} slides`);
        assert(output[0].id && output[0].id.length > 0, 'First slide has valid ID');
        assert(output[0].title.length > 0, 'First slide has title');
      } catch (e) {
        assert(false, 'Output is valid JSON: ' + e.message);
      }
    }
  }

  if (TEST_NAME === 'test-capture' || TEST_NAME === 'test-all') {
    console.log('\n─── test: Capture (3 slides) ───');
    pkill(); await sleep(2000);
    fs.mkdirSync(TMP_OUTPUT, { recursive: true });
    const r = runScript('ayoa-capture-slides.js', [
      '--cookies', COOKIES, '--target', TARGET, '--output', TMP_OUTPUT,
      '--from', '1', '--to', '3', '--wait', '1000'
    ], { timeout: 120000 });
    assert(r.status === 0, `ayoa-capture-slides.js exits with code ${r.status}`);
    if (r.status === 0) {
      const files = fs.readdirSync(TMP_OUTPUT).filter(f => f.endsWith('.png'));
      assert(files.length >= 3, `At least 3 PNG files captured (got ${files.length})`);
      ['slide-001.png','slide-002.png','slide-003.png'].forEach(f => {
        assert(fs.existsSync(path.join(TMP_OUTPUT, f)), `${f} exists`);
      });
      ['slide-001.png','slide-002.png','slide-003.png'].forEach(f => {
        const buf = Buffer.alloc(8);
        try {
          const fd = fs.openSync(path.join(TMP_OUTPUT, f), 'r');
          fs.readSync(fd, buf, 0, 8, 0);
          fs.closeSync(fd);
          assert(buf.toString('hex') === '89504e470d0a1a0a', `${f} has valid PNG signature`);
        } catch (e) {
          assert(false, `${f} read error: ${e.message}`);
        }
      });
    } else {
      console.error('  stderr:', (r.stderr || '').slice(-500));
    }
  }

  if (TEST_NAME === 'test-video' || TEST_NAME === 'test-all') {
    console.log('\n─── test: Video ───');
    const videoOutput = path.join(TMP_DIR, 'test-video.mp4');
    // Generate synthetic test slides if needed
    if (!fs.existsSync(TMP_OUTPUT) || fs.readdirSync(TMP_OUTPUT).filter(f => f.endsWith('.png')).length < 2) {
      console.log('  Generating test slides via ffmpeg...');
      fs.mkdirSync(TMP_OUTPUT, { recursive: true });
      spawnSync('ffmpeg', ['-f','lavfi','-i','color=c=black:s=320x240:d=1', '-frames:v','1', path.join(TMP_OUTPUT,'slide-001.png')], { timeout: 30000 });
      spawnSync('ffmpeg', ['-f','lavfi','-i','color=c=blue:s=320x240:d=1', '-frames:v','1', path.join(TMP_OUTPUT,'slide-002.png')], { timeout: 30000 });
      spawnSync('ffmpeg', ['-f','lavfi','-i','color=c=red:s=320x240:d=1', '-frames:v','1', path.join(TMP_OUTPUT,'slide-003.png')], { timeout: 30000 });
    }
    const r = runScript('ayoa-video.js', [
      '--input', TMP_OUTPUT, '--output', videoOutput,
      '--fps', '1/1', '--crf', '28'
    ], { timeout: 120000 });
    assert(r.status === 0, `ayoa-video.js exits with code ${r.status}`);
    if (r.status === 0) {
      assert(fs.existsSync(videoOutput), 'Video file created');
      const stat = fs.statSync(videoOutput);
      assert(stat.size > 500, `Video file has content (${stat.size} bytes)`);
      const probe = spawnSync('ffprobe', ['-v','error','-show_entries','format=duration,size','-of','default=noprint_wrappers=1', videoOutput], { encoding: 'utf8', timeout: 10000 });
      assert(probe.status === 0, 'ffprobe can read the video');
      assert(probe.stdout.includes('duration='), 'Duration metadata present');
    }
  }

  // Summary
  const total = passed + failed;
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Resultado: ${passed}/${total} passed, ${failed} failed`);

  // Cleanup
  if (fs.existsSync(TMP_DIR)) {
    try { fs.rmSync(TMP_DIR, { recursive: true }); } catch {}
  }
  pkill();

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => { console.error('FATAL:', e); process.exit(1); });
