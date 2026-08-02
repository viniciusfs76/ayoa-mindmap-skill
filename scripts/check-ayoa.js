#!/usr/bin/env node
// check-ayoa.js — Ad-hoc script para checar cookies Ayoa sem Puppeteer.
//
// Uso:
//   node scripts/check-ayoa.js [path/to/cookies.json]
//
// Default: ~/storage/downloads/cookiesAyoa.json
//
// Saída: lista todos os cookies cujo domain contém "ayoa.com" com
// expiration status (EXPIRED / OK). Mostra também os 3 críticos
// (ayoa.ap, ayoa.sid, ayoa.user) em destaque.
//
// Resolve o falso-positivo do validator canônico (que detecta EXPIRED
// em cookies de outros sites como PPLX). Validado 2026-07-19.

'use strict';

const fs = require('fs');
const path = require('path');

const COOKIE_FILE = process.argv[2] || path.join(process.env.HOME, 'storage/downloads/cookiesAyoa.json');

if (!fs.existsSync(COOKIE_FILE)) {
  console.error(`Cookie file not found: ${COOKIE_FILE}`);
  console.error('Usage: node scripts/check-ayoa.js [path]');
  process.exit(1);
}

let cookies;
try {
  const raw = fs.readFileSync(COOKIE_FILE, 'utf8');
  cookies = JSON.parse(raw);
} catch (e) {
  console.error(`Cookie file is not valid JSON: ${e.message}`);
  console.error('This usually means the file is truncated (clipboard race on Android).');
  console.error('Re-export from Chrome via EditThisCookie without copying partial content.');
  process.exit(1);
}

const now = Math.floor(Date.now() / 1000);
const ayoaDomains = ['.ayoa.com', 'ayoa.com', 'auth.ayoa.com', 'app.ayoa.com', 'www.ayoa.com'];
const critical = ['ayoa.ap', 'ayoa.sid', 'ayoa.user'];

console.log(`Total cookies in file: ${cookies.length}`);

const ayoaCookies = cookies.filter(c => {
  if (!c.domain) return false;
  return ayoaDomains.some(d => c.domain.includes(d));
});

console.log(`Ayoa-domain cookies: ${ayoaCookies.length}`);
console.log('');

if (ayoaCookies.length === 0) {
  console.error('No Ayoa-domain cookies found. Did you re-export from Chrome?');
  process.exit(1);
}

let allCriticalOk = true;
for (const c of ayoaCookies) {
  // expirationDate can be either seconds or milliseconds; convert if needed
  const exp = c.expirationDate;
  const expSec = exp > 1e10 ? Math.floor(exp / 1000) : exp;
  const expired = expSec ? expSec < now : false;
  const isCrit = critical.includes(c.name);
  const marker = isCrit ? '[CRITICAL]' : '';
  const status = expired ? 'EXPIRED' : 'OK';
  console.log(`  ${marker} ${c.domain.padEnd(22)} ${c.name.padEnd(40)} exp=${expSec} status=${status}`);
  if (isCrit && expired) allCriticalOk = false;
}

console.log('');
if (allCriticalOk) {
  console.log('RESULT: All 3 critical Ayoa cookies are valid (expired=false).');
  console.log('         Cookie file may be used for Ayoa login pipelines.');
  process.exit(0);
} else {
  console.error('RESULT: At least one critical Ayoa cookie has EXPIRED.');
  console.error('         Re-export from Chrome via EditThisCookie.');
  process.exit(2);
}