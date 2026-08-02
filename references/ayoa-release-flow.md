# Release flow — when the local bundle and the live repo diverge

This is the operational recipe used to cut release v1.16.3 of
`viniciusfs76/ayoa-mindmap-skill` from a freshly-staged local bundle
on Termux. The pattern generalises to any skill that ships with extra
bundled files (publish helper scripts, CODEOWNERS, doc pages) that the
live GitHub repo did not have in its prior tag.

## Background

The Ayoa skill is published in two locations:

1. `~/.hermes/skills/software-development/ayoa-mindmap/` — local
   Hermes skill bundle. Has `scripts/`, `references/`, `templates/`,
   `SKILL.md`, `CHANGELOG.md`, `LICENSE`, plus the helper scripts
   (`publish-skill-to-github.sh`, `publish-from-clipboard.sh`).
2. `https://github.com/viniciusfs76/ayoa-mindmap-skill` — GitHub
   mirror, last pushed at v1.6.0 (May 2026). Has the same `scripts/`
   plus `docs/`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`,
   and its own `publish-*.sh` scripts.

The two layouts drift. A naive "clone live + overwrite with local
bundle + push" loses the live-only files (`docs/`, `CODEOWNERS`,
contributing guides). A naive "push the bundle as a fresh repo"
breaks the user's mental model because the GitHub history goes away.

The merge path that works on Termux is below.

## Step 0 — Accept a fresh PAT

Read the GitHub PAT from the clipboard using `termux-clipboard-get`,
store it in a `chmod 600` `mktemp` file, and feed it to `gh auth login
--with-token`. Shred the temp file on EXIT. Do not echo or persist
the PAT in chat or in the skill logs.

```bash
TOKEN_FILE="$(mktemp -t gh-pat.XXXXXX)"
trap 'shred -u "$TOKEN_FILE" 2>/dev/null || rm -f "$TOKEN_FILE"' EXIT
termux-clipboard-get > "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"
gh auth login --with-token < "$TOKEN_FILE" >/dev/null 2>&1
gh auth status --hostname github.com
```

## Step 1 — Clone the live repo shallow

`git clone --depth 1 <url>` to avoid carrying old history. The shallow
clone is enough to read the live layout and detect divergent commits.

```bash
LIVE="$HOME/tmp/ayoa-mindmap-skill-live"
rm -rf "$LIVE"
git clone --depth 1 https://github.com/viniciusfs76/ayoa-mindmap-skill "$LIVE"
```

## Step 2 — Copy v1.x files into the live tree

For each new or modified file in the local bundle, copy it into the
matching path under `$LIVE`. Use a `cp` loop that walks the source list
explicitly (NOT `cp -r scripts/ $LIVE/scripts/` because the live tree
may have extra scripts you want to keep):

```bash
SRC="$HOME/.hermes/skills/software-development/ayoa-mindmap"
LIVE="$HOME/tmp/ayoa-mindmap-skill-live"
for f in SKILL.md references/ayoa-capture-flow-test-pattern.md \
         scripts/import-opml.js scripts/ayoa-capture-slides.js \
         scripts/ayoa-presenter.js scripts/ayoa-video.js \
         scripts/tests/ayoa-output.test.js scripts/tests/fixtures/*.opml \
         scripts/tests/_pyayoa_opml.py scripts/tests/test_opml_import.py \
         scripts/pytest.ini; do
  mkdir -p "$LIVE/$(dirname "$f")"
  if [ -d "$SRC/$f" ]; then cp -r "$SRC/$f" "$LIVE/$f"
  else cp "$SRC/$f" "$LIVE/$f"; fi
done
```

## Step 3 — Resolve file collisions

When the live repo already has a file with the same name but newer
content (e.g. `references/ayoa-learned-cases.md`, `references/pitfalls.md`,
`references/ayoa-test-suite-manifest.md`), the copy step will overwrite
them silently. That is usually the intent — the local skill is the
source of truth — but **check `git status` after the copy** and decide
case by case:

```bash
cd "$LIVE"
git status -sb
```

Two patterns to look for:

- `M  references/ayoa-learned-cases.md` — modified by your copy. Keep.
- `A  references/references/ayoa-...md` — added under a double-nested
  path because both `references/` (local) and `references/` (live)
  existed. Flatten by moving `references/references/X` to
  `references/X`, skipping the destination if it already exists (the
  live repo's version wins).

```bash
for f in references/references/*; do
  target="references/$(basename "$f")"
  if [ -e "$target" ]; then
    echo "  CONFLICT: $target exists, skipping $f"
  else
    mv "$f" "$target"
  fi
done
rmdir references/references 2>/dev/null || true
```

## Step 4 — Bump live version + test list

The live `package.json` keeps its own scripts and version field. Patch
the version with `sed` and append the new test files to the test list
using Python (the list is space-separated inside a `cd scripts && …`
chain, easier to handle with a small script than `sed`):

```bash
sed -i 's/"version": "1.6.0"/"version": "1.16.3"/' package.json
python3 - <<'PY'
import json
p = json.load(open('package.json'))
addons = ['tests/ayoa-import-fixtures.test.js',
          'tests/ayoa-capture-flow.test.js',
          'tests/ayoa-multi-slide-capture.test.js']
old = p['scripts']['test'].split()
tail = old[-1]; head = ' '.join(old[:-1])
new = ' '.join([head] + addons + [tail])
p['scripts']['test'] = new; p['version'] = '1.16.3'
json.dump(p, open('package.json', 'w'), indent=2)
PY
```

## Step 5 — Amend + force-with-lease push

If you committed in step 2 already (or staged), force-with-lease is
the safe force-push — it refuses if the remote advanced past your
local main since you cloned.

```bash
cd "$LIVE"
git add -A
git commit -q --amend --no-edit   # fold flatten + bump into the same commit
git push --force-with-lease origin main
git push --force origin v1.16.3   # the tag was already created locally
```

## Step 6 — Cut the GitHub release

Use `gh release create` with the CHANGELOG entry as notes. Generate
the notes from the SKILL.md changelog block (one bullet per release)
so the release page mirrors the skill metadata:

```bash
gh release create v1.16.3 \
  --title 'v1.16.3 — <one-liner>' \
  --notes-file "$HOME/release-notes-v1.16.3.md" \
  --target main
```

## Pitfalls captured in this flow

- **Shallow clone before bundle step**: don't `git pull --rebase`
  against a live `main` that diverges by 67 files; you'll spend more
  time resolving conflicts than the merge is worth. Clone shallow,
  flatten live tree, amend, force-with-lease.
- **Token exposure**: never paste the PAT in chat; never echo it; use
  the clipboard → `mktemp` → `gh auth login --with-token` path. The
  trap on EXIT calls `shred -u` so the temp file is overwritten before
  unlink.
- **Double-nested references/**: the local skill and the live repo
  both have a `references/` directory. Plain `cp -r references/`
  creates `references/references/`. Always check `git status -sb`
  after the copy and flatten before committing.
- **`/tmp` permission denied on Termux**: `termux-clipboard-get`
  succeeds when reading the clipboard, but writing the token into
  `/tmp/` may fail because Termux's `/tmp/` is owned by `u0_aXXX`. Use
  `$HOME/tmp/` or `mktemp -t gh-pat.XXXXXX` (which respects `$TMPDIR`).
- **`gh release create` needs `cd` into the live repo first**: running
  from `$HOME` fails with `fatal: not a git repository`. Always `cd`
  before `gh release`.

## What this recipe does NOT cover

- First-time publication of a brand-new repo (no live tree exists).
  For that, `gh repo create --public --source . --remote origin
  --push` works.
- Multi-branch releases (e.g. publishing a beta tag to `v1.17.0-beta1`
  on a separate branch). Add a `--prerelease` flag to `gh release
  create` and target the branch.
- Auto-generated release notes. The notes file used here is hand-written
  from the changelog; `gh release create --generate-notes` works but
  does not include the long-form bullets that document pitfalls.