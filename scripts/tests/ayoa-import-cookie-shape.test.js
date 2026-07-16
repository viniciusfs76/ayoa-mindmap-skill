'use strict';
// Tests for the cookie normalisation layer used by the OPML import. Captures
// the EditThisCookie→Puppeteer gap (sameSite "unspecified"/"no_restriction",
// missing leading dot on domain) that previously caused Ayoa to silently
// drop the auth cookies and redirect to auth.ayoa.com/login.

const test = require('node:test');
const assert = require('node:assert/strict');

function normaliseCookie(c) {
  let ss = c.sameSite || 'Lax';
  if (ss === 'no_restriction') ss = 'None';
  if (!['Lax', 'Strict', 'None'].includes(ss.charAt(0).toUpperCase() + ss.slice(1))) ss = 'Lax';
  return {
    name: String(c.name),
    value: String(c.value),
    domain: c.domain && c.domain.startsWith('.') ? c.domain : `.${c.domain}`,
    path: String(c.path || '/'),
    httpOnly: Boolean(c.httpOnly),
    secure: Boolean(c.secure),
    sameSite: ss.charAt(0).toUpperCase() + ss.slice(1),
  };
}

test('normaliseCookie: Ayoa auth cookies pass through', () => {
  const result = normaliseCookie({ name: 'ayoa.ap', value: 'sig', domain: '.ayoa.com', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' });
  assert.deepEqual(result, { name: 'ayoa.ap', value: 'sig', domain: '.ayoa.com', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' });
});

test('normaliseCookie: missing leading dot on domain is added', () => {
  const r = normaliseCookie({ name: 'ayoa.sid', value: 'v', domain: 'ayoa.com' });
  assert.equal(r.domain, '.ayoa.com');
});

test('normaliseCookie: no_restriction → None', () => {
  const r = normaliseCookie({ name: '_ga', value: 'v', domain: '.ayoa.com', sameSite: 'no_restriction' });
  assert.equal(r.sameSite, 'None');
});

test('normaliseCookie: invalid sameSite falls back to Lax', () => {
  const r = normaliseCookie({ name: '_ga', value: 'v', domain: '.ayoa.com', sameSite: 'unspecified' });
  assert.equal(r.sameSite, 'Lax');
});

test('normaliseCookie: missing sameSite defaults to Lax', () => {
  const r = normaliseCookie({ name: '_fbp', value: 'v', domain: '.ayoa.com' });
  assert.equal(r.sameSite, 'Lax');
});

test('normaliseCookie: all boolean fields are coerced', () => {
  const r = normaliseCookie({ name: 'x', value: 'y', domain: '.ayoa.com', httpOnly: 1, secure: 0, path: '/api' });
  assert.equal(r.httpOnly, true);
  assert.equal(r.secure, false);
  assert.equal(r.path, '/api');
});

test('normaliseCookie: empty domain becomes . (unsupported but no crash)', () => {
  const r = normaliseCookie({ name: 'x', value: 'y', domain: '' });
  assert.equal(r.domain, '.');
});
