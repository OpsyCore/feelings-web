#!/usr/bin/env bash
# Builds the FEELINGS Android package (APK + AAB) locally with Bubblewrap.
# Requires: Node.js 18+ and internet. JDK 17 and the Android SDK are downloaded
# automatically by Bubblewrap on first run (into ~/.bubblewrap).
#
# Usage:
#   ./scripts/build-twa-local.sh            # signs with feelings.keystore (store build)
#   ./scripts/build-twa-local.sh --test     # signs with a throwaway key (sideload testing only)
set -euo pipefail

cd "$(dirname "$0")/../android-twa"

MODE="store"
if [ "${1:-}" = "--test" ]; then MODE="test"; fi

if [ "$MODE" = "test" ]; then
  KEY_PATH="feelings-test.keystore"
  KEY_ALIAS="feelings-test"
  KEY_PASSWORD="bubblewrap-test"
  if [ ! -f "$KEY_PATH" ]; then
    keytool -genkeypair -v -keystore "$KEY_PATH" -alias "$KEY_ALIAS" \
      -keyalg RSA -keysize 2048 -validity 7 \
      -storepass "$KEY_PASSWORD" -keypass "$KEY_PASSWORD" \
      -dname "CN=FEELINGS Local Test Key, O=Throwaway, C=US"
  fi
else
  KEY_PATH="feelings.keystore"
  KEY_ALIAS="feelings"
  if [ ! -f "$KEY_PATH" ]; then
    echo "ERROR: $KEY_PATH not found next to twa-manifest.json." >&2
    echo "Copy your real keystore into android-twa/ or run ./scripts/make-signing-key.sh." >&2
    exit 1
  fi
  read -rsp "Keystore password: " KEY_PASSWORD
  echo
fi

# Bubblewrap reads the passwords from these environment variables (no interactive prompt).
export BUBBLEWRAP_KEYSTORE_PASSWORD="$KEY_PASSWORD"
export BUBBLEWRAP_KEY_PASSWORD="$KEY_PASSWORD"

npx --yes @bubblewrap/cli@1.25.0 build \
  --skipPwaValidation \
  --skipVersionUpgrade \
  --signingKeyPath "$KEY_PATH" \
  --signingKeyAlias "$KEY_ALIAS"

echo
echo "Artifacts:"
ls -la app-release-signed.apk app-release-bundle.aab 2>/dev/null || true
echo
if [ "$MODE" = "test" ]; then
  echo "TEST build: install the APK directly on a phone (allow 'install unknown apps')."
  echo "Do NOT upload it to Bazaar or Google Play."
else
  echo "STORE build: APK -> Bazaar, AAB -> Google Play Console."
fi
