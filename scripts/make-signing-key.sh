#!/usr/bin/env bash
# Creates the FEELINGS store signing key ONCE, on a trusted machine.
# Requires: JDK (keytool). Run OUTSIDE the repository or anywhere you like;
# then keep the keystore backed up (two offline copies). It is gitignored.
#
# Usage: ./scripts/make-signing-key.sh [keystore-file] [alias]
set -euo pipefail

KEYSTORE="${1:-feelings.keystore}"
ALIAS="${2:-feelings}"

if ! command -v keytool >/dev/null 2>&1; then
  echo "keytool not found. Install a JDK first (e.g. Temurin 17: https://adoptium.net)." >&2
  exit 1
fi

if [ -e "$KEYSTORE" ]; then
  echo "ERROR: $KEYSTORE already exists. Never overwrite a signing key." >&2
  exit 1
fi

echo "Creating signing key: $KEYSTORE (alias: $ALIAS, RSA 2048, valid ~27 years)"
read -rsp "Choose a keystore password (min 6 chars, remember it — you will need it again): " PASS
echo
read -rsp "Repeat the password: " PASS2
echo
if [ "$PASS" != "$PASS2" ] || [ "${#PASS}" -lt 6 ]; then
  echo "ERROR: passwords must match and be at least 6 characters." >&2
  exit 1
fi

keytool -genkeypair -v \
  -keystore "$KEYSTORE" -alias "$ALIAS" \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$PASS" -keypass "$PASS" \
  -dname "CN=Feelings, OU=Mobile, O=Feelings, L=Tehran, C=IR"

echo
echo "SHA256 fingerprint (paste into public/.well-known/assetlinks.json):"
keytool -list -v -keystore "$KEYSTORE" -alias "$ALIAS" -storepass "$PASS" \
  | grep -i 'SHA256' || true

echo
echo "Next steps:"
echo "  1. Back up $KEYSTORE in two offline places."
echo "  2. ./scripts/set-signing-secrets.sh $KEYSTORE $ALIAS"
echo "  3. Put the SHA256 fingerprint into public/.well-known/assetlinks.json and redeploy."
echo "  4. GitHub Actions -> 'Android TWA package' -> signing_mode=store -> Run workflow."
