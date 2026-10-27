#!/usr/bin/env bash
# Uploads the FEELINGS signing key to GitHub Actions secrets for this repository.
# Requires: gh (GitHub CLI, logged in) and base64. The key file itself is NEVER committed.
#
# Usage: ./scripts/set-signing-secrets.sh [keystore-file] [alias]
set -euo pipefail

KEYSTORE="${1:-feelings.keystore}"
ALIAS="${2:-feelings}"

if [ ! -f "$KEYSTORE" ]; then
  echo "ERROR: $KEYSTORE not found. Run ./scripts/make-signing-key.sh first." >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh (GitHub CLI) not found. Install it or add the four secrets manually in" >&2
  echo "GitHub repo -> Settings -> Secrets and variables -> Actions." >&2
  exit 1
fi

read -rsp "Keystore password: " PASS
echo

base64 < "$KEYSTORE" | tr -d '\n' | gh secret set ANDROID_KEYSTORE_BASE64
printf '%s' "$PASS" | gh secret set ANDROID_KEYSTORE_PASSWORD
printf '%s' "$PASS" | gh secret set ANDROID_KEY_PASSWORD
printf '%s' "$ALIAS" | gh secret set ANDROID_KEY_ALIAS

echo
echo "Secrets set: ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_PASSWORD, ANDROID_KEY_ALIAS"
echo "Now run: GitHub Actions -> 'Android TWA package' -> signing_mode=store -> Run workflow."
