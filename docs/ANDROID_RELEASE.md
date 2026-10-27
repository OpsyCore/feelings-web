# FEELINGS Android release runbook

## Platform strategy (owner decision, 2026-09-28)
- **Android:** distributed as a store package (Google Play and Bazaar) using a **Trusted Web Activity** that wraps the verified, deployed PWA. This is Google's sanctioned PWA-to-Play path: full-screen Chrome runtime, no WebView wrapper, the same verified web product and the same Supabase contract.
- **iOS:** intentionally **not** on the App Store. iOS users install the PWA (Safari → Share → Add to Home Screen). Nothing further is planned for iOS.
- **Native Kotlin / Jetpack Compose** remains the long-term Android roadmap per `ANDROID_HANDOFF.md` (offline-first, push, native UX). The TWA is the bridge that gets a real package into stores now; it does not replace that plan.
- Web updates ship to the Android package instantly, because the TWA loads the deployed site. A new store upload is only needed when the wrapper itself changes (icons, package id, versionCode bumps).

## 1. Prerequisites
1. The current branch is deployed to `https://opsycore.github.io/feelings-web` over HTTPS and serves `/manifest.webmanifest`, `/sw.js` and `/icons/*` (see `DEPLOYMENT.md`).
2. A Google Play Console developer account and a Bazaar developer account.
3. A signing key (next section). The same key signs every future release; back it up offline.

## 2. Create the signing key once (on a trusted machine with JDK 17)
```bash
./scripts/make-signing-key.sh            # wrapper around keytool; prints the SHA256 line
```
Equivalent raw commands, if you prefer them:
```bash
keytool -genkeypair -v -keystore feelings.keystore -alias feelings \
  -keyalg RSA -keysize 2048 -validity 10000
keytool -list -v -keystore feelings.keystore -alias feelings | grep SHA256
```
The `SHA256:` line is the upload-key fingerprint needed in step 3.

Store the key for CI (never commit the file — `*.keystore` is gitignored):
```bash
./scripts/set-signing-secrets.sh         # sets all four GitHub Actions secrets via gh
```
It sets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS=feelings`. Without `gh`, add the same four secrets manually under repo Settings → Secrets and variables → Actions.

## 3. Verify the domain (full-screen TWA, no browser fallback bar)
1. Put the fingerprint from step 2 into `public/.well-known/assetlinks.json` (colon-separated uppercase hex, exactly as keytool prints it) and redeploy.
2. Check `https://opsycore.github.io/feelings-web/.well-known/assetlinks.json` returns JSON with `Content-Type: application/json`.
3. Validate with Play Console's Digital Asset Links tester (or `https://developers.google.com/digital-asset-links/v1/statements:list?source.web.site=...`).

### Build facts learned the hard way (do not regress)
- `android-twa/` contains a **committed, generated Bubblewrap gradle project** plus `manifest-checksum.txt` (sha1 of `twa-manifest.json`). If the manifest changes, regenerate the checksum (`sha1sum android-twa/twa-manifest.json | cut -d" " -f1 | tr -d "\n" > android-twa/manifest-checksum.txt`) or CI hangs on a prompt.
- The manifest uses Bubblewrap's own schema: `appVersion` (not `appVersionName`), and `splashScreenFadeOutDuration` must be present or the generated `build.gradle` is invalid.
- CI passes passwords via `BUBBLEWRAP_KEYSTORE_PASSWORD` / `BUBBLEWRAP_KEY_PASSWORD` env vars (the CLI has no password flag) and writes `~/.bubblewrap/config.json` from `JAVA_HOME`/SDK, with a `bin -> cmdline-tools/latest/bin` symlink because Bubblewrap 1.x validates the SDK root by `tools/` or `bin/`.
- Every successful CI run also commits the outputs to the working branch under `release-artifacts/` (gitignored locally; delete that folder's commits before merging to main — the Actions artifact remains downloadable for 90 days regardless).

## 4. Build the package
**CI (recommended):** Actions → "Android TWA package" → Run workflow, and pick `signing_mode`:
- `test` — no secrets needed. The runner creates a throwaway key, so you can download and sideload `app-release-signed.apk` on a phone **today** (it shows a browser bar and must never go to a store).
- `store` — signs with the real key from the secrets of step 2 and prints its SHA256 fingerprint for step 3. Output is store-ready: `app-release-signed.apk` (Bazaar) + `app-release-bundle.aab` (Google Play).

**Local:** `./scripts/build-twa-local.sh` (store build, needs `android-twa/feelings.keystore`) or `./scripts/build-twa-local.sh --test` (throwaway key). Only Node + internet required; Bubblewrap fetches JDK/SDK on first run.
**Zero-install alternative for a first APK:** pwabuilder.com against the deployed URL also produces a signed Android package; use the CI route for anything you intend to keep updating.

## 5. Store listings
All listing text and graphics are prepared in `store/` (see `store/README.md`):
- **Google Play:** upload the **AAB**, package id `app.feelings.android`. Title/short/full descriptions are ready in `store/google-play/listings/{fa-IR,en-US}/`; the data-safety form answers are in `store/google-play/DATA_SAFETY.md`; icon and feature graphic are in `store/assets/`. The TWA must keep the deployed site live at all times.
- **Bazaar:** upload the **APK**. Every field (name, category, tags, texts, age rating) is ready to copy/paste from `store/bazaar/listing-fa.md`; use the same signing key as Play so users can move between stores later.
- Screenshots are the only item you must capture yourself — step-by-step in `store/README.md`.
- Keep `appVersionCode` in `android-twa/twa-manifest.json` monotonic; bump it for every store upload.

## 6. What the TWA does not give you
- No background push (in-app realtime notifications only, same as web).
- No offline business data beyond the cached shell.
- Store review depends on the deployed site being reachable and functional.
If any of these become product requirements, that is the trigger to start the native Compose project.
