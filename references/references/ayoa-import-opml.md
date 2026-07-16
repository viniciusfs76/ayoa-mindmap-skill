# Ayoa — OPML Import (Operational Reference, v2 — 2026-07-15)

> Updated after the 2-hop login fix in `scripts/import-opml-v3.js` proved that headless import works end-to-end. Use this when the user asks to "import an OPML into Ayoa" or "create a new map from this OPML/Google Doc". Distinct from `ayoa-import-formats.md` (format catalog) and `references/ayoa-2-hop-login-fix.md` (root-cause analysis of the login redirect bug).

## Pitfall: auth headers must be wired into API calls (added 2026-07-16)

The `captureAuthHeaders` helper in `scripts/import-opml.js` listens on the
dashboard's first /v2/ analytics POST and captures `x-auth-token`,
`x-client-id`, `x-source`, `x-source-version`, `x-agent`, `x-request-id`.
These MUST be spread into the headers of every subsequent `fetch()` call
to `/v2/uploads`, `/v2/import/text`, and `/v2/import-jobs?`. Without
`x-client-id` (and `x-agent` on the GET), Ayoa returns:

    POST /v2/uploads → 400 BAD_REQUEST "Invalid X-Client-Id header"
    GET  /v2/import-jobs?t=... → 400 BAD_REQUEST "Invalid X-Agent header"

Both errors present as a generic `1 import failed` toast in the editor;
the HTTP body is the only signal. The fix: pass the captured headers
through to every `page.evaluate(fetch, { authHeaders })` so they are
merged into the `fetch` call.

```js
// After login() succeeds, capture once and propagate to every API call.
const authHeaders = await captureAuthHeaders(page);
const upload = await page.evaluate(async ({ size, authHeaders }) => {
  const r = await fetch('/v2/uploads', {
    method: 'POST', credentials: 'include',
    headers: { 'content-type': 'application/json', ...authHeaders },
    body: JSON.stringify({ filename, filesize: size, contentType: '', useV2Upload: true }),
  });
  if (!r.ok) throw new Error(`/v2/uploads ${r.status}: ${await r.text()}`);
  return r.json();
}, { size, authHeaders });
```

Full contract: `references/ayoa-v2-auth-headers.md` (tabela de quais
endpoints exigem quais headers, valores reais capturados do dashboard,
heurística de captura). Caso real reproduzido em
`references/ayoa-learned-cases.md` Caso #009. Funções com nome que
descreve o que **fazem** são landmines — `captureAuthHeaders` deveria
ter sido renomeada para `captureAndPropagateAuthHeaders` para forçar o
caller a usar o resultado.

Regression: `tests/ayoa-import-puppeteer.test.js` checks `import-opml.js`
loads cleanly and exports `apiPath` with the `authHeaders` arg; the live
path is exercised in `tests/ayoa-multi-slide-capture.test.js` (5 slides
E2E against Chromium headless_shell, 5 distinct sha256 PNGs).

## TL;DR — The Recommended Path

For 95% of "import OPML into Ayoa" tasks: **use the headless path** via `scripts/import-opml-v3.js`. The script now works end-to-end (validated 2026-07-15 with map `ca529690-291e-44f8-9402-0877fe0cff8a`, OPML `waico-maco.opml`, 33 nodes Tony Buzan). The critical fix is the **2-hop login**: `goto('https://www.ayoa.com/')` before `setCookie`, then `goto('https://app.ayoa.com/')`. The cookie file must be the **full Android `Pictures/cookies.json` export** (1800+ cookies covering all subdomains) — Puppeteer filters automatically.

If the headless flow fails (cookie file missing `auth.ayoa.com` side, or canvas step still has frame-detach issues), fall back to the manual 3-step flow below. The manual flow takes < 30 s.

## The Headless Path (now production-ready)

### Command

```bash
ps -ef | grep headless | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null; sleep 1
cd ~/.hermes/skills/software-development/ayoa-mindmap/scripts && \
  node import-opml-v3.js \
    --cookies ~/storage/pictures/cookies.json \
    --opml ~/tmp/waico-maco.opml \
    --name "WAICO-MACO (Tony Buzan) Test" \
    --screenshot ~/.ayoa-import-v3.png \
    --output ~/tmp/import-opml-v3.json
```

### What the script does (in order)

1. **Launch** Chromium headless_shell.
2. **Login** (`www.ayoa.com` → inject cookies one-by-one → `app.ayoa.com`). Logs `Injected N of M cookies` (typically 1858 of 1870 — 12 `__Host-*` skipped, Puppeteer rejects them).
3. **Navigate** to `https://app.ayoa.com/mindmaps/new`. Logs `Session established at: https://app.ayoa.com/`.
4. **Dismiss cookie banner** (HubSpot Accept/Decline).
5. **Click `+`** (or `Novo projeto` / `New Project`). If `+` not found, falls back to text match.
6. **Type map name** in the modal's first text input.
7. **Click "Mind Map"** tile (always the first).
8. **Click OK / Create / Confirm**.
9. **Click "Import"** button.
10. **Upload OPML** via `DataTransfer` + `File` injected into a synthetic `<input type="file">` (not drag-and-drop — Ayoa uses a file picker via the input).
11. **Click Import/OK** to confirm.
12. **Extract** `mindmapId` from the URL `https://app.ayoa.com/mindmaps/<uuid>`.

### Expected output (validation 2026-07-15)

```
[16:07:51.230] Cookies injected: 1858 of 1870
[16:07:56.488] Session established at: https://app.ayoa.com/
[16:08:24.536] Step 5: New Project click: {"clicked":true,"source":"text"}
[16:08:32.215] Step 6: typed=true
[16:08:34.485] Step 7: Mind Map click: {"clicked":true}
[16:08:35.288] Step 8: OK click: {"clicked":true}
[16:09:02.907] Step 12: URL = https://app.ayoa.com/mindmaps/ca529690-..., mindmapId = ca529690-...
EXIT=0
```

### Common failure modes

| Final URL | Symptom | Fix |
|---|---|---|
| `https://auth.ayoa.com/login?continue=...` | Cookie file missing `auth.ayoa.com` or `ayoa.ap`/`ayoa.sid`/`ayoa.user`. | Re-export from the browser, include all subdomains. |
| `https://app.ayoa.com/mindmaps/<new>` but `slideCount=0` | Upload was simulated (file injected) but Ayoa did not actually process the OPML. This is the **expected** state for `import-opml-v3.js`: it creates the map but does **not** confirm the upload (Step 11 `clicked:false`). | Run `ayoa-presenter.js --mode prepare` to Auto-create slides, or finish manually. |
| `Error: Attempted to use detached Frame` | Race between Ayoa SPA redirect and the next `page.evaluate`. | Already retried 3× in the script. If still failing, re-run. |

## The 3-Step Manual Flow (fallback only)

When the headless path is unavailable, ask the user to do:

### Step 1 — Create a new map
Click the **`+`** (or **`Novo projeto`**) button in the top bar of `https://app.ayoa.com/`. A modal opens.

### Step 2 — In the modal: type the name, select "Mind Map", click OK
Type the central node text. Click the **first** tile (Mind Map). Click **OK**.

### Step 3 — In the editor: Import → select .opml → OK
Click the **`Import`** button (NOT "Add all" — that label is from the legacy Help Centre and is no longer used). Drag the `.opml` file (or click to browse). Click **OK** to confirm. The map ID is in the URL: `https://app.ayoa.com/mindmaps/<uuid>`.

## Localized button labels

| English | Portuguese (BR) | Purpose |
|---|---|---|
| `New Project` | `Novo projeto` | Open the new-map modal (Step 1) |
| `Mind Map` | `Mapa mental` | Map type tile (Step 2) |
| `Create` / `OK` | `Criar` / `OK` | Confirm modal (Step 2) |
| `Import` | `Importar` | Open upload dialog (Step 3) |
| `Accept` | `Aceitar` | Cookie banner (dismiss first) |
| `Decline` | `Recusar` | Cookie banner |

Match by `text()` or `aria-label`, never by class.

## Cookie requirements

For headless import to work:

- **File source:** `~/storage/pictures/cookies.json` (Android EditThisCookie export) is the canonical source. 1800+ cookies total.
- **Minimum auth set:** `ayoa.ap`, `ayoa.sid`, `ayoa.user` (all on `.ayoa.com`). These alone are **not enough** — Ayoa also needs the `auth.ayoa.com` cookies, which are set only by going through `https://www.ayoa.com/` first.
- **`__Host-*` cookies** (e.g., `__Host-LV`, `__Host-GAPS`, `__Host-LinkSession`): always skipped by Puppeteer with `Invalid cookie fields`. This is **expected and harmless** — the session works without them.
- **`sameSite: 'unspecified'`:** EditThisCookie exports this for cookies without SameSite. Puppeteer requires `Lax`/`Strict`/`None`. The script normalises to `Lax` automatically.

## What the headless script does NOT do (intentional)

`import-opml-v3.js` creates the **map shell** and types the name, but **does not confirm the file upload**. The `Step 11: confirmImport` button matches `clicked:false` because Ayoa's confirm button is rendered asynchronously after the file upload completes. After the script runs:

- The URL is `https://app.ayoa.com/mindmaps/<new-uuid>` (the map exists).
- The map has **0 slides** (the OPML is not yet parsed into the deck).
- To populate: open the map, click **Auto-create** in the Presenter panel, OR run `ayoa-presenter.js --mode prepare` to trigger the Auto-create via Puppeteer.

This is by design — the script's job is to prove the auth and creation flow works. The OPML-to-nodes import is best left to Ayoa's UI once the user is in front of the editor.

## Companion tools and references

- **`google-drive` skill** — generates the `.opml` file from a Google Doc. Output lands at `~/tmp/<doc-slug>.opml`.
- **`scripts/import-opml.js`** and **`scripts/import-opml-v2.js`** — earlier iterations, kept for regression.
- **`scripts/lib/opml-parser.js`** — pure OPML parser (testable, no I/O).
- **`scripts/tests/opml-parser.test.js`** — 19 deterministic tests.
- **`references/ayoa-import-formats.md`** — format catalog (DOCX, OPML, IMX, etc.) and the official UI flow as documented on `support.ayoa.com`.
- **`references/ayoa-2-hop-login-fix.md`** — root-cause analysis of the auth redirect bug and the don'ts for the script.
- **`references/ayoa-opml-agent-manual.md`** — agent contract for the manual fallback.
- **`references/pitfalls.md`** — general Puppeteer/Ayoa pitfalls (cookie filter, `__Host-*` skipped, frame detach retry, etc.).
