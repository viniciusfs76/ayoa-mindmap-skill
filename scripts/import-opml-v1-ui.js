#!/usr/bin/env node
'use strict';

// import-opml.js — CLI entrypoint: import OPML → Ayoa mind map.
//
// Usage:
//   node import-opml.js --opml F --cookies F [--name N] [--screenshot-dir D] [--headless]
//
// If cookies are invalid or missing, falls back to manual instructions.

const fs = require('node:fs');
const path = require('node:path');
const { parseOpml } = require('./lib/opml-parser.js');
const { AyoaAutomation } = require('./lib/ayoa-automation.js');

function parseArgs() {
  const out = { _pos: [] };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = process.argv[i + 1];
      if (v && !v.startsWith('--')) { out[k] = v; i++; } else out[k] = true;
    } else out._pos.push(a);
  }
  return out;
}

const HELP = `import-opml — Import OPML as Ayoa Mind Map

Usage:
  node import-opml.js --opml <file.opml> [options]

Required:
  --opml        Path to OPML file

Options:
  --cookies     Path to cookies JSON (default: ~/tmp/ayoa-cookies-test.json)
  --name        Mind map name (default: from OPML title)
  --headless    Run headless (default: true)
  --screenshot-dir  Save screenshots to directory
  --dry-run     Parse OPML only, no import
  --help        Show this message
`;

async function main() {
  const args = parseArgs();

  if (args.help || args._pos.includes('--help')) {
    process.stdout.write(HELP);
    return 0;
  }

  // Read OPML
  const opmlPath = args.opml;
  if (!opmlPath) { process.stderr.write('ERROR: --opml required\n' + HELP); return 64; }
  if (!fs.existsSync(opmlPath)) { process.stderr.write(`ERROR: OPML file not found: ${opmlPath}\n`); return 64; }
  const opmlText = fs.readFileSync(opmlPath, 'utf8');
  const parsed = parseOpml(opmlText);
  process.stderr.write(`OPML parsed: ${parsed.nodeCount} nodes, depth ${parsed.maxDepth}\n`);
  process.stderr.write(`  central: "${parsed.central}"\n`);

  if (args['dry-run']) {
    process.stdout.write(JSON.stringify(parsed, null, 2) + '\n');
    return 0;
  }

  const mapName = args.name || parsed.central || 'Untitled';
  const cookiesPath = args.cookies || path.join(process.env.HOME, 'tmp', 'ayoa-cookies-test.json');
  const screenshotDir = args['screenshot-dir'] || null;
  const screenshots = screenshotDir ? [
    path.join(screenshotDir, '1-modal.png'),
    path.join(screenshotDir, '2-after-create.png'),
    path.join(screenshotDir, '3-uploaded.png'),
    path.join(screenshotDir, '4-final.png'),
  ] : [];

  // Launch automation
  const auto = new AyoaAutomation({ cookiesPath, headless: args.headless !== 'false' });
  await auto.launch();

  process.stderr.write('Injecting cookies...\n');
  const authenticated = await auto.injectCookies();
  if (!authenticated) {
    process.stderr.write(`WARN: Cookies at ${cookiesPath} do not authenticate (Ayoa login page detected).\n`);
    process.stderr.write('Manual import instructions:\n');
    process.stderr.write(`  1. Open https://app.ayoa.com/ (login manually)\n`);
    process.stderr.write(`  2. + → New → Mind Map → name "${mapName}" → OK\n`);
    process.stderr.write(`  3. Import → select ${opmlPath} → Import\n`);
    process.stderr.write(`  4. Pass the mindmap URL back to the agent\n`);
    await auto.close();
    process.stdout.write(JSON.stringify({ ok: false, authenticated: false, opml: opmlPath, mapName }, null, 2) + '\n');
    return 1;
  }

  process.stderr.write('Session authenticated. Starting import...\n');
  const result = await auto.importOpml({ opmlText, mapName, screenshots });
  await auto.close();

  process.stderr.write(`Import complete: ${result.url}\n`);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  return 0;
}

if (require.main === module) {
  main().then((code) => process.exit(code), (e) => {
    process.stderr.write(`FATAL: ${e.stack || e.message}\n`);
    process.exit(1);
  });
}

module.exports = { main, parseArgs, HELP };
