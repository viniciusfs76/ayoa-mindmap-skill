'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
process.argv.push('--cookies', path.join(process.env.HOME, 'tmp/fake.json'), '--target', 'https://app.ayoa.com/mindmaps/fake');
const login = require('./ayoa-login.js');

test('navigateToMindmap dismisses a non-clickable cookie banner through DOM fallback', async () => {
  let fallbackClicks = 0;
  const page = {
    async goto() { return { status: () => 200 }; },
    async evaluate(fn) {
      const source = String(fn);
      if (source.includes('const text = document.body')) return { loading: false, editor: true };
      if (source.includes('button[aria-label="Accept"]')) { fallbackClicks += 1; return true; }
      return false;
    },
    async $(selector) {
      if (selector !== 'button[aria-label="Accept"]') return null;
      return { async click() { throw new Error('Node is either not clickable or not an Element'); } };
    },
    url() { return 'https://app.ayoa.com/mindmaps/fake'; },
  };
  const finalUrl = await login.navigateToMindmap(page, 'https://app.ayoa.com/mindmaps/fake', { initialWait: 0 });
  assert.equal(finalUrl, 'https://app.ayoa.com/mindmaps/fake');
  assert.equal(fallbackClicks, 1);
});
