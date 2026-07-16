# Ayoa 2-hop login fix (2026-07-15)

> Critical patch for `scripts/import-opml-v3.js` and any other Puppeteer-based
> Ayoa automation. Captures the root cause of the `auth.ayoa.com/login` redirect
> bug that blocked all headless OPML imports.

## Root cause

`page.setCookie(...cookies)` only sets cookies for a single domain. When called
while on `https://app.ayoa.com/`, the cookies are bound to `app.ayoa.com` and the
Ayoa SPA detects that the session was never bootstrapped from the root domain
(`www.ayoa.com`). The SPA then redirects to `auth.ayoa.com/login` and the
import flow fails at step 1 (New Project button never appears).

This is why `ayoa-presenter.js --mode list` works (it has the correct
`login()` + `navigateToMindmap()` helpers) but `import-opml-v3.js` did not.

## Fix (apply to all Puppeteer Ayoa scripts)

```js
// Step 1: navigate to ROOT domain (required before setCookie)
await page.goto('https://www.ayoa.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });

// Step 2: inject cookies (1858/1870 typically work; 12 __Host-* skipped)
await page.setCookie(...cookies);

// Step 3: navigate to APP subdomain to establish session
await page.goto('https://app.ayoa.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
// → Session established at: https://app.ayoa.com/
```

## Validation (2026-07-15)

After applying this fix, `import-opml-v3.js` with the waico-maco OPML (33
nodes Tony Buzan) created map `ca529690-291e-44f8-9402-0877fe0cff8a` via
headless flow:

```
[16:07:51.230] Cookies injected: 1858 of 1870
[16:07:51.230] Navigating to app.ayoa.com...
[16:07:56.488] Session established at: https://app.ayoa.com/
[16:07:56.490] Navigating to https://app.ayoa.com/mindmaps/new ...
[16:08:24.536] Step 5: New Project click: {"clicked":true,"source":"text"}
[16:08:34.485] Step 7: Mind Map click: {"clicked":true}
[16:08:35.288] Step 8: OK click: {"clicked":true}
[16:09:02.907] Step 12: URL = https://app.ayoa.com/mindmaps/ca529690-..., mindmapId = ca529690-...
EXIT=0
```

The canonical implementation is in `scripts/ayoa-login.js` (`login()` function).

## Don'ts

- `page.goto('https://app.ayoa.com/')` then `setCookie` (causes redirect).
- Importing `ayoa-login.js` via `require()` triggers `parseArgs()` side-effect
  on module load — re-implement `login()` inline.
- Using only `_fbp`/`_ga`/`_rdt_*` cookies (no Ayoa auth, just tracking).
- Trying to import `__Host-*` cookies via Puppeteer (always rejected with
  "Invalid cookie fields"; safe to skip, the session works without them).

## See also

- `references/ayoa-import-formats.md` — 13 supported formats
- `references/ayoa-import-opml.md` — manual import recipe
- `references/ayoa-opml-agent-manual.md` — agent contract for OPML import
- `scripts/ayoa-login.js` — canonical `login()` + `navigateToMindmap()` (don't `require()`, copy)
- `scripts/import-opml-v3.js` — working implementation with the 2-hop fix
- `scripts/lib/opml-parser.js` — pure OPML parser (testable, no I/O)
- `scripts/tests/opml-parser.test.js` — 19 deterministic tests
- `references/pitfalls.md` — `__Host-*` cookies skipped by Puppeteer (12/1870)
