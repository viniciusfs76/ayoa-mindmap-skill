'use strict';
// Deterministic tests for the output-path helper. No browser required.
//
// The skill now lands PNGs and the MP4 in
//   <HOME>/storage/downloads/ayoa_skill/<sanitised-mapName>/
// so multiple invocations don't overwrite each other and the user can find
// the artifact by mindmap name on Android Files.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { sanitise, extractBoardName, resolveOutputDir } = require('../lib/ayoa-output.js');

test('sanitise: keeps A-Z a-z 0-9 _ - and trims; replaces others with _', () => {
  // Spaces become underscores; the regular hyphen is preserved.
  assert.equal(sanitise('Final da Copa 2026 - Argentina x Espanha'),
    'Final_da_Copa_2026_-_Argentina_x_Espanha');
  // The em-dash (U+2014) is not in the NFKD compatibility decomposition
  // table, so it stays as-is and is replaced with '_' by the ASCII filter.
  assert.equal(sanitise('WAICO — Preatoria'), 'WAICO_Preatoria');
  assert.equal(sanitise('   leading and trailing   '), 'leading_and_trailing');
  assert.equal(sanitise(''), 'untitled');
  assert.equal(sanitise(null), 'untitled');
  // Truncates to 64 chars.
  const long = 'a'.repeat(200);
  assert.equal(sanitise(long).length, 64);
});

test('extractBoardName: prefers --name, then OPML <title>, then URL segment', () => {
  assert.equal(extractBoardName({ explicitName: 'Minha Versao' }), 'Minha_Versao');
  const opml = '<?xml version="1.0"?><opml><head><title>Final da Copa</title></head><body></body></opml>';
  assert.equal(extractBoardName({ opmlText: opml }), 'Final_da_Copa');
  assert.equal(extractBoardName({ targetUrl: 'https://app.ayoa.com/mindmaps/ca529690-291e-44f8-9402-0877fe0cff8a' }),
    'ca529690-291e-44f8-9402-0877fe0cff8a');
  // Empty inputs fall back to 'untitled'.
  assert.equal(extractBoardName({}), 'untitled');
});

test('resolveOutputDir: writes into <HOME>/storage/downloads/ayoa_skill/<name>/', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ayoa-output-'));
  const home = path.join(tmp, 'home');
  fs.mkdirSync(home);
  const dir = resolveOutputDir({
    home,
    targetUrl: 'https://app.ayoa.com/mindmaps/abc-123',
  });
  assert.equal(dir, path.join(home, 'storage', 'downloads', 'ayoa_skill', 'abc-123'));
  assert.ok(fs.existsSync(dir), 'directory should be created');
  // Re-call is idempotent.
  resolveOutputDir({ home, targetUrl: 'https://app.ayoa.com/mindmaps/abc-123' });
  assert.ok(fs.existsSync(dir));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('resolveOutputDir: override wins and is created if missing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ayoa-output-override-'));
  const home = path.join(tmp, 'home');
  fs.mkdirSync(home);
  const custom = path.join(tmp, 'my-special-place');
  const dir = resolveOutputDir({
    home,
    override: custom,
    targetUrl: 'https://app.ayoa.com/mindmaps/abc-123',
  });
  assert.equal(dir, custom);
  assert.ok(fs.existsSync(custom));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('resolveOutputDir: distinct targets get distinct subfolders', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ayoa-output-multi-'));
  const home = path.join(tmp, 'home');
  fs.mkdirSync(home);
  const a = resolveOutputDir({ home, targetUrl: 'https://app.ayoa.com/mindmaps/aaaa-1111' });
  const b = resolveOutputDir({ home, targetUrl: 'https://app.ayoa.com/mindmaps/bbbb-2222' });
  const c = resolveOutputDir({ home, explicitName: 'CUSTOM_NAME' });
  assert.notEqual(a, b);
  assert.notEqual(b, c);
  assert.notEqual(a, c);
  fs.rmSync(tmp, { recursive: true, force: true });
});
