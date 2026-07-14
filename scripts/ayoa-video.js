// ayoa-video.js — Gerar vídeo MP4 a partir dos slides PNG
//
// Uso:
//   node ayoa-video.js --input <dir> [--output <path>] [--fps 1/3] [--crf 23]
//
// --input: diretório com slide-001.png ... slide-NNN.png
// --output: caminho do MP4 (padrão: ../apresentacao-ayoa.mp4)
// --fps: framerate (padrão 1/3 = 3s por slide)
// --crf: qualidade H.264 (padrão 23)

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
const INPUT_DIR = path.resolve(ARGS.input || `${process.env.HOME}/storage/downloads/presentation`);
const OUTPUT_FILE = path.resolve(ARGS.output || path.join(INPUT_DIR, '..', 'apresentacao-ayoa.mp4'));
const FRAMERATE = ARGS.fps || '1/3';
const CRF = ARGS.crf || '23';
const PRESET = ARGS.preset || 'medium';

const log = (...a) => console.error(`[${new Date().toISOString().slice(11,23)}]`, ...a);

(async () => {
  // Validate input
  if (!fs.existsSync(INPUT_DIR)) {
    throw new Error(`Input directory not found: ${INPUT_DIR}`);
  }

  const files = fs.readdirSync(INPUT_DIR)
    .filter(f => f.startsWith('slide-') && f.endsWith('.png'))
    .sort();

  if (files.length === 0) {
    throw new Error(`No slide-*.png files found in ${INPUT_DIR}`);
  }

  log(`Found ${files.length} slides in ${INPUT_DIR}`);
  log(`Output: ${OUTPUT_FILE}`);
  log(`Framerate: ${FRAMERATE} (${FRAMERATE === '1/3' ? '3s per slide' : FRAMERATE})`);

  // Verify ffmpeg
  const ffmpegCheck = spawnSync('which', ['ffmpeg'], { encoding: 'utf8' });
  if (ffmpegCheck.status !== 0) {
    throw new Error('ffmpeg not found. Install with: pkg install ffmpeg');
  }

  // Build ffmpeg command
  const args = [
    '-framerate', FRAMERATE,
    '-pattern_type', 'glob',
    '-i', 'slide-*.png',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-crf', CRF,
    '-preset', PRESET,
    OUTPUT_FILE,
  ];

  log('Running ffmpeg...');
  const result = spawnSync('ffmpeg', args, {
    cwd: INPUT_DIR,
    encoding: 'utf8',
    timeout: 300000, // 5 min
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    console.error('ffmpeg stderr:', result.stderr?.slice(-1000));
    throw new Error(`ffmpeg exited with code ${result.status}`);
  }

  // Verify output
  const stat = fs.statSync(OUTPUT_FILE);
  log(`Video created: ${OUTPUT_FILE}`);
  log(`Size: ${(stat.size / 1024 / 1024).toFixed(1)}MB`);

  // Get duration via ffprobe
  const probe = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    OUTPUT_FILE,
  ], { encoding: 'utf8', timeout: 10000 });
  
  if (probe.status === 0) {
    const durationSec = parseFloat(probe.stdout.trim());
    const mins = Math.floor(durationSec / 60);
    const secs = Math.floor(durationSec % 60);
    log(`Duration: ${mins}m${secs}s (${files.length} slides x ${FRAMERATE === '1/3' ? '3s' : FRAMERATE})`);
  }

  log('Done');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
