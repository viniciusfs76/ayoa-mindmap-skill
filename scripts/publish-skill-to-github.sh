#!/data/data/com.termux/files/usr/bin/bash
# publish-skill-to-github.sh
# Generic publisher for any skill bundle under ~/tmp/<repo>-<version>/.
# Captures the GitHub PAT from the Termux clipboard (without printing it),
# authenticates `gh`, creates the remote repo (public) if it doesn't exist,
# pushes the bundle's main branch, creates a vX.Y.Z tag, and cuts a release
# using the bundle's CHANGELOG.md as release notes.
#
# Never echoes the token. Never accepts the token as a CLI argument.
# Validates clipboard shape (prefix + length + regex) without printing values.
# Falls back gracefully when the PAT is Fine-grained (cannot create repos).
#
# Usage:
#   1. Copy the PAT to clipboard.
#   2. bash publish-skill-to-github.sh [repo-name] [version]
#
# Defaults: REPO_NAME=ayoa-mindmap-skill, VERSION=v1.6.0
# Pinned to: REPO_OWNER=viniciusfs76 (override with env var)

set -euo pipefail

REPO_OWNER="${REPO_OWNER:-viniciusfs76}"
REPO_NAME="${1:-ayoa-mindmap-skill}"
VERSION="${2:-v1.6.0}"
BUNDLE_DIR="${BUNDLE_DIR:-$HOME/tmp/${REPO_NAME}-${VERSION#v}/}"
TMP_TOKEN="$(mktemp -t gh-pat.XXXXXX)"
trap 'shred -u "$TMP_TOKEN" 2>/dev/null || rm -f "$TMP_TOKEN"' EXIT

# --- Pre-flight checks ----------------------------------------------------

if [[ ! -d "$BUNDLE_DIR/.git" ]]; then
  echo "error: bundle $BUNDLE_DIR is not a git repo" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI not in PATH" >&2
  exit 1
fi

# --- Capture PAT from clipboard (metadata only) ---------------------------

CLIP="$(termux-clipboard-get 2>/dev/null || true)"
case "$CLIP" in
  github_pat_*|ghp_*)
    PREFIX="${CLIP:0:11}"
    LEN=${#CLIP}
    echo "captured $PREFIX... ($LEN chars)"
    ;;
  *)
    HEAD=$(printf '%s' "$CLIP" | head -c 11)
    echo "error: clipboard does not contain a github_pat_* or ghp_* token" >&2
    echo "       (got ${#CLIP} chars; head='$HEAD')" >&2
    exit 1
    ;;
esac

# Write to a private tmpfile (umask 077 in effect from shell defaults on Termux).
# Trap shreds it on exit — success or failure.
printf '%s' "$CLIP" >"$TMP_TOKEN"

# --- Authenticate gh --------------------------------------------------------

echo "authenticating gh..."
gh auth login --with-token <"$TMP_TOKEN" >/dev/null
gh auth status --hostname github.com | head

# --- Create or push repo ----------------------------------------------------

if gh repo view "${REPO_OWNER}/${REPO_NAME}" >/dev/null 2>&1; then
  echo "repo ${REPO_OWNER}/${REPO_NAME} already exists, pushing..."
  git -C "$BUNDLE_DIR" remote remove origin 2>/dev/null || true
  git -C "$BUNDLE_DIR" remote add origin "https://github.com/${REPO_OWNER}/${REPO_NAME}.git"
  git -C "$BUNDLE_DIR" push -u origin main
else
  echo "creating repo ${REPO_OWNER}/${REPO_NAME} (public)..."
  if ! gh repo create "${REPO_OWNER}/${REPO_NAME}" \
    --public \
    --description "$(grep -m1 '^description' "$BUNDLE_DIR/package.json" 2>/dev/null | sed -E 's/^description: *"?(.*?)"?$/\1/' || echo "Puppeteer skill for the Ayoa Mindmap Present mode.")" \
    --source "$BUNDLE_DIR" \
    --remote origin \
    --push; then
    echo "warning: gh repo create failed (likely Fine-grained PAT without admin scope)" >&2
    echo "         create the repo manually at https://github.com/new" >&2
    echo "         then re-run this script to push the bundle" >&2
    exit 2
  fi
fi

# --- Setup git credential helper (so 'git push' works without username) ----

gh auth setup-git >/dev/null 2>&1 || true

# --- Tag and release --------------------------------------------------------

echo "tagging $VERSION..."
if ! git -C "$BUNDLE_DIR" rev-parse "$VERSION" >/dev/null 2>&1; then
  git -C "$BUNDLE_DIR" tag -a "$VERSION" -m "$VERSION: bundle release"
fi
git -C "$BUNDLE_DIR" push origin "$VERSION" || true

if [[ -f "$BUNDLE_DIR/CHANGELOG.md" ]]; then
  echo "creating release $VERSION..."
  gh release create "$VERSION" \
    --title "$VERSION" \
    --notes-file "$BUNDLE_DIR/CHANGELOG.md" \
    --target main \
    || echo "warning: gh release create failed (PAT may lack Contents: write)" >&2
fi

echo "done."
echo "next steps:"
echo "  1. visit https://github.com/${REPO_OWNER}/${REPO_NAME}"
echo "  2. confirm Actions tab shows the lint-and-test workflow"
echo "  3. enable branch protection on main (require status checks: lint-and-test)"
