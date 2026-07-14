#!/data/data/com.termux/files/usr/bin/bash
# publish-ayoa-mindmap-skill.sh
# Empacota o bundle local, autentica o `gh` com o PAT do clipboard e publica o
# repositório `viniciusfs76/ayoa-mindmap-skill` no GitHub.
#
# Pré-requisitos:
#   1. ~/.local/bin/gh disponível (gh 2.95.0+).
#   2. PAT do GitHub com escopos `repo, workflow, read:org` no clipboard.
#   3. Conexão à internet.
#
# Como rodar (uma vez, após colar o PAT):
#   $ bash publish-ayoa-mindmap-skill.sh
#
# O PAT nunca é gravado em disco: é lido do clipboard, instalado em
# `~/.config/gh/hosts.yml` apenas em memória, e o arquivo é `shred -u` no fim.

set -euo pipefail

REPO_OWNER="${REPO_OWNER:-viniciusfs76}"
REPO_NAME="${REPO_NAME:-ayoa-mindmap-skill}"
BUNDLE_DIR="${BUNDLE_DIR:-$HOME/tmp/$REPO_NAME-v1.6.0}"
CLIPBOARD_TOOL="${CLIPBOARD_TOOL:-termux-clipboard-get}"
TMP_TOKEN="$(mktemp -t gh-pat.XXXXXX)"
trap 'shred -u "$TMP_TOKEN" 2>/dev/null || rm -f "$TMP_TOKEN"' EXIT

if [[ ! -d "$BUNDLE_DIR/.git" ]]; then
  echo "error: bundle $BUNDLE_DIR is not a git repo" >&2
  exit 1
fi

if ! command -v "$CLIPBOARD_TOOL" >/dev/null 2>&1; then
  echo "error: $CLIPBOARD_TOOL not found in PATH" >&2
  echo "       install with: pkg install termux-api" >&2
  exit 1
fi

echo "reading PAT from clipboard..."
"$CLIPBOARD_TOOL" >"$TMP_TOKEN"
if [[ ! -s "$TMP_TOKEN" ]]; then
  echo "error: clipboard is empty" >&2
  exit 1
fi

echo "authenticating gh..."
gh auth login --with-token <"$TMP_TOKEN"
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
git -C "$BUNDLE_DIR" tag -a v1.6.0 -m "v1.6.0: 178 deterministic tests in 16 suites"
git -C "$BUNDLE_DIR" push origin v1.6.0
gh release create v1.6.0 \
  --title "v1.6.0" \
  --notes-file "$BUNDLE_DIR/CHANGELOG.md" \
  --target main

echo "done."
echo "next steps:"
echo "  1. visit https://github.com/${REPO_OWNER}/${REPO_NAME}"
echo "  2. confirm Actions tab shows the lint-and-test workflow"
echo "  3. enable branch protection on main (require status checks: lint-and-test)"
