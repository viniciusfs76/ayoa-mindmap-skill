'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
process.argv.push('--cookies', path.join(process.env.HOME, 'tmp/fake.json'), '--target', 'https://app.ayoa.com/mindmaps/fake');
const login = require('./ayoa-login.js');

function makePage(sequence) {
  let loadingChecks = 0;
  return {
    async goto() { return { status: () => 200 }; },
    async evaluate(fn) {
      const src = String(fn);
      if (src.includes('const text = document.body')) {
        const loading = sequence[loadingChecks++] ?? true;
        return { loading, editor: !loading };
      }
      return false;
    },
    async $() { return null; },
    url() { return 'https://app.ayoa.com/mindmaps/fake'; },
    stats() { return { loadingChecks }; },
  };
}

test('navigateToMindmap keeps polling until Ayoa leaves the loading state', async () => {
  const page = makePage([true, true, false]);
  await login.navigateToMindmap(page, 'https://app.ayoa.com/mindmaps/fake', {
    initialWait: 0, pollInterval: 1, readyTimeout: 50,
  });
  assert.equal(page.stats().loadingChecks, 3);
});

test('navigateToMindmap fails clearly when Ayoa never becomes ready', async () => {
  const page = makePage([true, true, true, true, true, true]);
  await assert.rejects(
    () => login.navigateToMindmap(page, 'https://app.ayoa.com/mindmaps/fake', {
      initialWait: 0, pollInterval: 1, readyTimeout: 3,
    }),
    /did not finish loading/i,
  );
});
