# Drive doc -> Ayoa mindmap -> MP4 video (end-to-end)

The class of work: the user has a Google Doc (or any markdown source) and
wants a recorded Ayoa presentation derived from it. This reference ties
together `google-drive-global` + `ayoa-mindmap` into a runnable recipe.

Validated twice in production (2026-07-16):

- **WAICO preatoria viagem China** (doc `1DyYLBDhYDNLEwWmlfx6inygKwk0rqulXwBNXwKgf3Sg`,
  modified 2026-07-16T08:53Z) -> mapa `f184cfe2-3fbb-4ddf-ab0f-4c70f0128aed`,
  69 slides, MP4 1m9s, 2.7 MB.
- **PORTARIA IPD Minuta Canonica v0.5** (doc `1aqiDzzsNrwrW6jPlgM7fUcw6s3w0mEtZRE0FwvSab_A`,
  modified 2026-07-14T21:16Z, folder `IPD de VCs/05_OUTPUTS_FINAIS`) ->
  mapa `43e22adb-8c8f-46dd-875d-0cab56936dfd`, 42 slides, MP4 42s, 1.4 MB.

## Pipeline (6 steps, all scripted, no manual clicks)

```
Drive doc -> markdown body -> OPML -> Ayoa import -> Auto-create slides -> PNGs -> MP4
```

### Step 1: locate the canonical doc

```bash
hermes-gdrive search --raw-query "name contains '<keyword>'" --max 30
```

If the folder is known, list its contents:

```bash
hermes-gdrive search --raw-query "'<folder-id>' in parents" --max 30
```

**Pitfall:** folder names often do NOT match the user's free-text description
(e.g., the user asked for "waico preatoria para viagem a china" but the actual
folder is `WAICO` and the doc is the most recent WAICO-China file under it,
identified by `modifiedTime`, not by folder name). Always pick the most
recent doc under the closest matching folder.

### Step 2: extract the body via Google Docs API

```bash
hermes-gapi docs get <documentId>
```

Output JSON has `.title` and `.body` (markdown-flavored). Truncate at 2-3 KB
of plain markdown text — anything beyond that exceeds Ayoa's per-node body
limit (50 KB Free, 60 KB Ultimate).

### Step 3: produce the OPML

Generate `~/tmp/<slug>.opml` directly (not via a tool) with one `<outline>`
per bullet. Keep maxDepth <= 3 because the Ayoa Auto-create generator
flattens depth-4+ nodes into the parent slide. Validate locally before
uploading:

```bash
node -e "const{parseOpml}=require('<skill>/scripts/lib/opml-parser.js'); \
  const r=parseOpml(require('fs').readFileSync('<opml>','utf8')); \
  console.log(JSON.stringify({title:r.title,nodeCount:r.nodeCount,maxDepth:r.maxDepth,branches:r.nodes.filter(n=>n.depth===1).map(n=>n.text)},null,2))"
```

The expected shape is `nodeCount` matching the user's plan, `maxDepth <= 3`,
and 4-10 top-level branches. If `maxDepth` is 4+, collapse nested bullets.

### Step 4: import into Ayoa (canonical API path)

```bash
node <skill>/scripts/import-opml.js \
  --cookies ~/.cookiesAyoa-domain.json \
  --opml ~/tmp/<slug>.opml \
  --name '<map-title>' \
  --screenshot ~/.ayoa-<slug>.png \
  --output ~/tmp/<slug>-ayoa-result.json
```

Exit code 0 + `result.ok === true` + `result.url` matching
`^https://app\.ayoa\.com/mindmaps/[0-9a-f-]{36}$`. Required auth headers
(`x-auth-token`, `x-client-id`, `x-source-version`, `x-agent`) are auto-captured
by `captureAuthHeaders()`; the bug of "captures headers but never propagates
them" was fixed in v1.16.4 -- see `references/ayoa-v2-auth-headers.md`.

**Required cookies:** 10 domain-filtered ayoa.com cookies at
`~/.cookiesAyoa-domain.json`. Use the full file from
`termux-clipboard-get` -> `~/.cookiesAyoa.json` -> filter to `*.ayoa.com`
domains. Without the `auth.ayoa.com` cookie, the login redirect loop never
resolves.

### Step 5: Auto-create slides + capture PNGs

```bash
# Generate the deck (Auto-create). 41 nodes -> 42 slides (central + 1/node).
node <skill>/scripts/ayoa-presenter.js \
  --cookies ~/.cookiesAyoa-domain.json \
  --target https://app.ayoa.com/mindmaps/<uuid> \
  --mode prepare --output ~/tmp/<slug>-prepare.json

# Capture one PNG per slide via Present mode. Output dir is auto-resolved
# to ~/storage/downloads/ayoa_skill/<sanitised-mapName>/ (lib/ayoa-output.js).
node <skill>/scripts/ayoa-capture-slides.js \
  --cookies ~/.cookiesAyoa-domain.json \
  --target https://app.ayoa.com/mindmaps/<uuid> \
  --name '<map-title>' --wait 1200
```

`--wait 1200` = 1.2s per slide (canvas pan/zoom settle). Capture time =
~1.3s/slide + 12s overhead per 50 slides. Output PNGs land in the
per-map subfolder automatically; do NOT pass `--output`.

**Pitfall:** older capture flows produced static slides because the
`navigateToSlide` helper only clicked the slide-item, not the Next arrow.
The current `goToSlideForCapture` waits for `activeId === expected &&
presenting` before each screenshot -- no recovery should fire.
If `WARNING: N slide(s) required Next-arrow recovery` appears in the log,
something has regressed; bump v1.16.3+ is mandatory.

### Step 6: encode MP4

```bash
node <skill>/scripts/ayoa-video.js \
  --input ~/storage/downloads/ayoa_skill/<sanitised-name> \
  --output ~/storage/downloads/ayoa_skill/<sanitised-name>/<slug>.mp4 \
  --fps 1 --crf 23

termux-open ~/storage/downloads/ayoa_skill/<sanitised-name>/<slug>.mp4
```

`--crf 23` is the sweet spot for slide decks (visually lossless at 1 fps,
~30-40 KB per slide at 1440x900). `--fps 1` = 1 second per slide; for
denser material use `--fps 1/3` (3s/slide).

## Total budget

For a 40-70 node deck: ~15 min from "user said go" to MP4 in the Android
Files app. The capture step dominates (1.3s/slide). All other steps are
sub-second.

## What to do when something breaks

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `import-opml.js` returns 400 `Invalid X-Client-Id` | auth headers not captured yet (server is strict) | the v1.16.4+ code propagates them; if you see this, you're on an old build |
| `prepare` finds 0 slides | `--mode prepare` not run before `capture-slides` | always run prepare first |
| Capture loop returns 0 PNGs but log says "49 slides found" | Chrome detached after setCookie | re-run with fresh cookies |
| All PNGs identical (sha256 collision) | fixture race or static-slide bug | you're on pre-v1.16.3 capture code; upgrade |
| MP4 produced but 0 bytes | ffmpeg missing | `pkg install ffmpeg` |
| `termux-open` silently no-ops | no default video app installed | install a player (e.g., VLC) |