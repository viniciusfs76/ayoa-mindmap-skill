# Ayoa captureAuthHeaders — Recipe (classe: post-login API gating)

Skill-level **recipe** for capturing the auth headers Ayoa's v2 API requires
after a successful login. This is the single most common failure mode of the
OPML import pipeline: 6 different POST endpoints each demand a partial
subset of `{x-auth-token, x-client-id, x-source, x-source-version, x-agent,
x-request-id}` and the browser will not inject them on programmatic
`fetch()`.

## When to use

You just ran `login(page, cookies)` against `www.ayoa.com` + `app.ayoa.com`
and the session check passed (no redirect to `auth.ayoa.com/login`). You now
need to call any of: `/v2/uploads`, `/v2/import/text`, `/v2/import-jobs`,
`/v2/analytics-events`, `/v2/sync`, `/v2/init`. **Before any of these can
succeed**, the request must carry the 5-6 auth headers above.

## Why the naive approach fails

`page.evaluate(async () => fetch('/v2/import-jobs'))` returns 200 in the
sense that the browser makes the request, BUT the Ayoa backend reads the
auth headers and rejects the call (or 400 BAD_REQUEST) because **the
programmatic fetch does not inherit the X-Auth-Token / X-Client-Id set by
the Ayoa SPA on the original navigation**. The browser, in modern Chromium
with CORS / Fetch metadata policy, hides those headers from `fetch()`
initiated by a script that did not negotiate them via the original page
load.

The **only** reliable capture is to hook a real outgoing request that the
Ayoa SPA made on its own (so the browser already attached the headers) and
read them off the CDP request event. The Ayoa dashboard emits
`POST /v2/client` (Centrifugo channel setup) within 1-2s of the dashboard
loading — that's the request to hook.

## Recipe

```js
'use strict';
// src/captureAuthHeaders.js
const puppeteer = require('puppeteer-core');
const REQUIRED = ['x-auth-token','x-client-id','x-source','x-source-version','x-agent'];

async function captureAuthHeaders(page, { timeoutMs = 25000 } = {}) {
  return new Promise((resolve, reject) => {
    let captured = null;
    const onReq = (r) => {
      if (captured) return;
      const u = r.url();
      if (!u.includes('app.ayoa.com/v2/')) return;
      const h = r.headers();
      if (h['x-auth-token'] && h['x-client-id']) {
        captured = {};
        for (const k of REQUIRED) if (h[k]) captured[k] = h[k];
      }
    };
    page.on('request', onReq);
    const t = setTimeout(() => {
      page.off('request', onReq);
      if (captured) resolve(captured);
      else reject(new Error(`auth headers not captured in ${timeoutMs}ms — no /v2/ request fired`));
    }, timeoutMs);
    // Navigate to the dashboard so the Ayoa SPA fires /v2/client (Centrifugo
    // channel setup). Without this, the browser hangs forever.
    (async () => {
      try {
        await page.goto('https://app.ayoa.com/', { waitUntil: 'domcontentloaded', timeout: 20000 });
      } catch {}
    })();
  });
}

module.exports = { captureAuthHeaders, REQUIRED };
```

Three rules, each empirically validated against `app.ayoa.com`:

1. **Filter to 5 known keys** (`x-auth-token`, `x-client-id`, `x-source`,
   `x-source-version`, `x-agent`). Passing through the full `r.headers()`
   will spread browser-side debug headers (e.g., `x-request-id` with
   unprintable characters) and the next `fetch()` call fails with
   `Failed to execute 'fetch' on 'Window': Invalid name`.

2. **Trigger an Ayoa request via `page.goto('https://app.ayoa.com/')`**
   BEFORE waiting. The hook is "did the Ayoa SPA fire any /v2/ call".
   The hook does not trigger that call on its own. The dashboard makes
   `/v2/client` (Centrifugo) within 1-2s of loading; that is the request
   to catch.

3. **Reject after timeout** (default 25s). A blank `{}` capture is
   almost always wrong — Ayoa will accept the next `fetch()` but return
   400 Invalid X-Client-Id.

## Symptoms → diagnosis

| Symptom in the next POST | Cause |
|---|---|
| `400 BAD_REQUEST detail "Invalid X-Client-Id header"` | `authHeaders` was empty (capture timeout) |
| `Failed to execute 'fetch' on 'Window': Invalid name` | Extra debug headers were spread into the request |
| `{"error":{"code":"NOT_FOUND"}}` (404 on `/v2/uploads`) | Cookie session has expired; redo the 2-hop login |
| `Redirected to auth.ayoa.com/login` | Login flow itself failed; check cookie domain `.ayoa.com` |

## Forwarding the headers to subsequent calls

Once captured, the headers must be spread into **every** `fetch()` that
hits `/v2/*`. The shape is:

```js
const headers = { 'content-type': 'application/json', ...authHeaders };
```

If `authHeaders` is `{}`, the call will fail with 400. Always check
`Object.keys(authHeaders).length >= 2` before proceeding; if it's < 2,
re-login and re-capture.

## Worked example (live)

Real headers captured at `2026-07-16T17:46:46Z` on Ayoa Web 8.170.89 against
mapa `43e22adb-8c8f-46dd-875d-0cab56936dfd`:

```
x-auth-token:   59929114-b0ea-49c3-896b-ee5d91fa3d0e
x-client-id:    df609980-e2de-41a4-ac28-0db5359ee950   (or 5b881215-...)
x-source:       web
x-source-version: 8.170.89
x-agent:        Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML,
                 like Gecko) HeadlessChrome/138.0.7204.168 Safari/537.36
```

Notice the `x-client-id` is per-session (not constant). Each Chromium
launch with a new cookies file gets a fresh client id from `/v2/client`.
This is **expected** — do not cache `x-client-id` across sessions.

## What does NOT work

- `page.evaluate(async () => fetch('/v2/import-jobs', { credentials:
  'include' }))` — fetches but does NOT carry the X-Auth-Token.
- `page.setExtraHTTPHeaders({...})` — applies to all requests but Ayoa's
  CORS preflight rejects unknown X-* values.
- `page.setBypassCSP(true)` — does not change the auth-header policy.
- Forging `x-auth-token` from `document.cookie` — the token is the
  `ayoa.ap` cookie value with `s:` prefix and HMAC signature, not just
  a copy.

## When to skip the capture

If you only need the dashboard for navigation (no API mutation), the
captured headers are irrelevant. The Puppeteer + cookies path is
sufficient for `page.goto`, `page.click`, `page.screenshot` etc. The
capture is only required before the first `fetch('/v2/...')` call.

## Cross-reference

- `references/ayoa-v2-auth-headers.md` (v1.16.4) — table of which
  endpoints require which headers.
- `references/ayoa-v2-import-api.md` (v1.16.2) — exact body shape of
  `/v2/uploads` and `/v2/import/text`.
- `references/pitfalls.md` — "Puppeteer + headless + fixtures" first
  section; add here a class-level pitfall (see below).
