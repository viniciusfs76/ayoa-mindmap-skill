'use strict';
// Centralised output-path resolution for the Ayoa skill.
//
// The user wants PNG/MP4 outputs to land in
//   ~/storage/downloads/ayoa_skill/<mapName>/
// so that mind maps don't collide and the layout is predictable across
// invocations. `mapName` is derived (in order) from:
//   1. The `--name` argument the user passed (preferred).
//   2. The `<title>` of the OPML they imported.
//   3. The last path segment of the `--target` Ayoa URL
//      (i.e., the mindmap UUID, which is always unique).
// The directory is sanitised to [A-Za-z0-9_-] so it works on any FAT/exFAT
// Android share.

const fs = require('node:fs');
const path = require('node:path');

function sanitise(name) {
  if (!name || typeof name !== 'string') return 'untitled';
  return name
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'untitled';
}

function extractBoardName({ explicitName, opmlText, targetUrl } = {}) {
  if (explicitName && explicitName.trim()) return sanitise(explicitName.trim());
  if (opmlText) {
    const m = opmlText.match(/<title>\s*([^<]+?)\s*<\/title>/);
    if (m) return sanitise(m[1]);
  }
  if (targetUrl) {
    try {
      const u = new URL(targetUrl);
      const parts = u.pathname.split('/').filter(Boolean);
      // /mindmaps/<uuid> -> uuid
      const last = parts[parts.length - 1] || 'untitled';
      return sanitise(last);
    } catch (_) { /* fall through */ }
  }
  return 'untitled';
}

function resolveOutputDir({ home, override, explicitName, opmlText, targetUrl, base = 'ayoa_skill' } = {}) {
  const H = home || process.env.HOME;
  if (override) {
    fs.mkdirSync(override, { recursive: true });
    return override;
  }
  const name = extractBoardName({ explicitName, opmlText, targetUrl });
  const dir = path.join(H, 'storage', 'downloads', base, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = { sanitise, extractBoardName, resolveOutputDir };
