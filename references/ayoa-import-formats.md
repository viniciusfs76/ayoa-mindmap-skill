# Ayoa — Import Formats (Official Documentation)

> Reference curated from `support.ayoa.com` (canonical source). Last verified: 2026-07-15.

This reference documents **every import format** supported by Ayoa's Mind Maps, the canonical UI flow, and the format-specific quirks documented in the official Help Centre.

## Source URLs (canonical)

- Hub: <https://support.ayoa.com/imports-and-exports> — landing page
- FAQ: <https://support.ayoa.com/import-files-into-ayoa-faq> — file types and limits
- iMindMap: <https://support.ayoa.com/opening-imindmap-files-in-ayoa> — `.imx` flow
- AI import: <https://support.ayoa.com/import-content-into-your-mind-maps-with-ai>
- AI prepare: <https://support.ayoa.com/prepare-to-import-with-ayoas-ai>
- PDF failures: <https://support.ayoa.com/import-a-pdf>

> ⚠ Pages with `importing-mind-maps-from-freemind`, `…-mindmeister`, `…-itero` (legacy) return **404** as of 2026-05-08. They were consolidated into `import-files-into-ayoa-faq`.

## Canonical UI Flow (all imports)

From `support.ayoa.com/import-files-into-ayoa-faq`:

1. Click the **`+ / Create New / New Project`** button.
2. Select **Mind Map**.
3. Click **Import**.
4. **Drag-and-drop** the file into the import box (or click to upload from device).
5. **Name** your Mind Map.
6. Click **Import**.
7. When complete, click **Show** → **Open**.

For iMindMap (`.imx`): same flow but **select the iMindMap tab** in step 4.

## File types and limits

| File Type | Used By | Use Case | Ultimate | Free |
|---|---|---|---|---|
| **DOCX** | Microsoft Word, Google Docs | Lecture/meeting notes → mind map | 60 MB / 50k chars | ❌ |
| **TXT** | TextEdit, Notepad | Plain-text notes | 60 MB / 50k chars | 20 MB |
| **PDF** | (any) | Handouts, minutes | 60 MB / 50k chars | ❌ |
| **PPTX** | PowerPoint, Google Slides | Slide decks | 60 MB / 50k chars | ❌ |
| **XLSX** | Excel, Google Sheets | Spreadsheets → patterns | 60 MB / 50k chars | ❌ |
| **OPML** | MindNode, XMind, iThoughts, SimpleMind, FreeMind, MindManager, TheBrain, Scapple | Migrate from other mind-map apps | 60 MB / 50k chars | 20 MB / 50k chars |
| **HTML** | Word export, Notion | Web planning docs | 60 MB / 50k chars | 20 MB / 50k chars |
| **MD** | Notion, Markdown apps | Linear notes → visual | 60 MB / 50k chars | 20 MB / 50k chars |
| **MP3** | Audio recorders | Lecture/meeting audio | 60 MB / 10/day | ❌ |
| **OGG** | Dictation apps | Voice notes | 60 MB / 10/day | ❌ |
| **JPG** | Photos, scanned maps | Hand-drawn → digital | 10 MB / 4096² px | ❌ |
| **PNG** | Hand-drawn maps | Image → editable | 10 MB / 4096² px | ❌ |
| **IMX** | iMindMap | Migrate from iMindMap | 60 MB | 20 MB / up to 10 files |

## Format-specific quirks

### OPML

- **Used by**: MindNode, XMind, iThoughts, SimpleMind, FreeMind, MindManager, TheBrain, Scapple.
- **Limite**: 60 MB / 50k chars (Ultimate), 20 MB / 50k chars (Free).
- **Notes**: Ayoa accepts standard OPML 2.0. Custom attributes (`_icon`, `_color`, `_note`) are preserved when round-tripping.
- **Output**: Ayoa exports OPML via `support.ayoa.com/opml-export`.

### iMindMap (.imx)

- **Tab selection**: select the **iMindMap tab** in the import dialog (different from generic tab).
- **Limit**: 10 files max for Free users.
- **Quoted from docs**: "iMindMap users can Import their files in .imx format directly into AYOA helping you transform these into the nextgen Mind Mapping solution!"

### PDF (failure modes)

- Scanned PDFs (image-only) **cannot** be imported directly.
- **Workaround** (from `import-a-pdf`):
  1. Upload PDF to Google Drive.
  2. Right-click → **Open With → Google Docs**.
  3. Save as DOCX.
  4. Import the DOCX into Ayoa.

### Audio (MP3, OGG)

- Max 10 imports/day.
- Up to 60 minutes per file.
- "Audio imports limited to 10 per day" — applies per workspace, not per user.

### Images (JPG, PNG)

- Max resolution: **4096 × 4096 px**.
- Max size: 10 MB.
- Ayoa OCRs the image to extract nodes.
- Hand-drawn maps are supported.

## AI-assisted imports

From `support.ayoa.com/import-content-into-your-mind-maps-with-ai`:

- **AI generate ideas** — type a topic, get a structured mind map.
- **YouTube URL import** — paste a YouTube URL, get a structured mind map of the video.
- **Audio import** — see above.
- All AI features are **Ultimate-plan only**.

## Plan gating summary

- **Free**: TXT, OPML, HTML, MD, IMX (up to 10 files).
- **Ultimate**: DOCX, PDF, PPTX, XLSX, MP3, OGG, JPG, PNG, AI features, unlimited IMX.

## Mapping to the `ayoa-mindmap` skill

| Doc reference | Skill usage |
|---|---|
| Import flow steps 1–7 | `import-opml.js` (Puppeteer automation, partial — needs further work for headless canvas) |
| OPML format | `google-drive/scripts/lib/parser.js` produces OPML-compatible `toMindMapOps` output |
| OPML export | The user can download the OPML file from `~/tmp/waico-maco.opml` and drag it into Ayoa |
| 60 MB / 50k char limit | Skill enforces `MAX_OPML_BYTES = 60 * 1024 * 1024` (TODO) |
| Free vs Ultimate detection | Skill reads `plan` from cookies/JSON (TODO) |

## Pitfalls

- **Headless canvas**: The `waitForSelector` for `contenteditable="true"` in the canvas times out — the Ayoa SPA mounts nodes via Shadow DOM or custom canvas elements that need specialised selectors. The `import-opml.js` script falls back to diagnostic screenshots.
- **Mixed-case heading text**: The Ayoa importer lower-cases node text on import for some formats (HTML, MD). Apply `.toUpperCase()` post-import if Tony Buzan compliance is required.
- **50k chars hard limit**: Long DOCX/PDF/MD files above 50k characters are silently truncated. Split the input beforehand.