#!/data/data/com.termux/files/usr/bin/bash
# publish-from-clipboard.sh
# Captures the GitHub PAT from the Termux clipboard (without printing it),
# authenticates `gh`, pushes the local aioa-mindmap-skill bundle to GitHub,
# and shreds the temporary token file on exit.

set -euo pipefail

REPO_OWNER="${REPO_OWNER:-viniciusfs76}"
REPO_NAME="${REPO_NAME:-ayoa-mindmap-skill}"
BUNDLE_DIR="${BUNDLE_DIR:-$HOME/tmp/$REPO_NAME-v1.6.0}"
TMP_TOKEN="$(mktemp -t gh-pat.XXXXXX)"
trap 'shred -u "$TMP_TOKEN" 2>/dev/null || rm -f "$TMP_TOKEN"' EXIT

if [[ ! -d "$BUNDLE_DIR/.git" ]]; then
  echo "error: bundle $BUNDLE_DIR is not a git repo" >&2
  exit 1
fi

CLIP="$(termux-clipboard-get)"
case "$CLIP" in
  github_pat_*|ghp_*) ;;
  *)
    echo "error: clipboard does not contain a github_pat_* or ghp_* token" >&2
    echo "       (got $(wc -c < <(printf '%s' "$CLIP")) chars; head='${CLIP:0:11}')" >&2
    exit 1
    ;;
esac

printf '%s' "$CLIP" >"$TMP_TOKEN"
TOKEN_LEN=$(wc -c <"$TMP_TOKEN")
echo "captured PAT ($TOKEN_LEN chars)"

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI not in PATH" >&2
  exit 1
fi

echo "authenticating gh..."
gh auth login --with-token <"$TMP_TOKEN" >/dev/null
gh auth status --hostname github.com | head

echo "creating repo ${REPO_OWNER}/${REPO_NAME} (public)..."
if ! gh repo view "${REPO_OWNER}/${REPO_NAME}" >/dev/null 2>&1; then
  gh repo create "${REPO_OWNER}/${REPO_NAME}" \
    --public \
    --description "Puppeteer skill for the Ayoa Mindmap Present mode (Ayoa Ultimate) — automated presentation preparation, navigation and video capture." \
    --source "$BUNDLE_DIR" \
    --remote origin \
    --push
else
  echo "repo already exists, pushing..."
  git -C "$BUNDLE_DIR" remote remove origin || true
  git -C "$BUNDLE_DIR" remote add origin "https://github.com/${REPO_OWNER}/${REPO_NAME}.git"
  git -C "$BUNDLE_DIR" push -u origin main
fi

echo "creating v1.6.0 tag and release..."
if ! git -C "$BUNDLE_DIR" rev-parse v1.6.0 >/dev/null 2>&1; then
  git -C "$BUNDLE_DIR" tag -a v1.6.0 -m "v1.6.0: 178 deterministic tests in 16 suites"
  git -C "$BUNDLE_DIR" push origin v1.6.0
fi
gh release create v1.6.0 \
  --title "v1.6.0" \
  --notes-file "$BUNDLE_DIR/CHANGELOG.md" \
  --target main

echo "done."
echo "next steps:"
echo "  1. visit https://github.com/${REPO_OWNER}/${REPO_NAME}"
echo "  2. confirm Actions tab shows the lint-and-test workflow"
echo "  3. enable branch protection on main (require status checks: lint-and-test)"
