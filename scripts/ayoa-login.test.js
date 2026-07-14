'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
process.argv.push('--cookies', path.join(process.env.HOME, 'tmp/fake.json'), '--target', 'https://app.ayoa.com/mindmaps/fake');
const login = require('./ayoa-login.js');

test('login retries the Ayoa app bootstrap after a transient navigation timeout', async () => {
  let appAttempts = 0;
  const page = {
    async goto(url) {
      if (url === 'https://app.ayoa.com/') {
        appAttempts += 1;
        if (appAttempts === 1) throw new Error('Navigation timeout of 30000 ms exceeded');
      }
      return { status: () => 200 };
    },
    async setCookie() {},
    url() { return 'https://app.ayoa.com/'; },
  };
  await login.login(page, [{ name: 'ayoa.sid', value: 'fake', domain: '.ayoa.com' }]);
  assert.equal(appAttempts, 2);
});
