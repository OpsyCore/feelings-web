# FEELINGS deployment

## Architecture
One React 19 + TypeScript application, Vite 7, Tailwind 4 and centralized CSS tokens. `src/App.tsx` is the entry point; `src/main.tsx` mounts it. Hash routes preserve static hosting compatibility. Backend integration uses the Supabase browser SDK, Auth, authenticated table queries, RPCs, private Realtime channels and private Storage signed URLs. There is no second database and no local fake backend.

## 1. Configure public credentials (do not commit)
Copy `.env.example` into the deployment's environment settings or a gitignored `.env.local`:
- `VITE_SUPABASE_URL=https://wsyfeitsqrxmvrjrghey.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<project publishable key>`
- Legacy alternative: `VITE_SUPABASE_ANON_KEY=<project anon key>`
- Leave `VITE_SUPABASE_SCHEMA_REVIEWED=false` until step 3 is actually complete.

The key and URL are missing in the current workspace. A project URL by itself does not authenticate a Supabase client. Never set a service-role key in a `VITE_` variable.

## 2. Inspect the SAME existing project before any migration
Supply `DATABASE_URL` only to the local/server-side read-only inspection process. The script refuses URLs whose direct host is not `db.wsyfeitsqrxmvrjrghey.supabase.co`, or whose Supabase pooler username is not `postgres.wsyfeitsqrxmvrjrghey`.

Run `node scripts/inspect-supabase.mjs` with the server environment configured. Capture the output privately. The script uses a read-only transaction and does not modify schema/data. It inspects tables, columns, constraints, indexes, functions, policies, grants, publications, replica identity, buckets and triggers. A restricted operator-provided schema export is also acceptable. Do not publish the database password or raw inspection output.

There is no Drizzle connection in the current workspace. Do not introduce an unrelated DATABASE_URL. If Drizzle is later restored, verify its host/pooler project identity first.

## 3. Reconcile the contract
Compare the export with `docs/DATABASE_SCHEMA.md` and `docs/API_CONTRACT.md`. Prefer adapting the client to compatible existing names/structures. Preserve records, IDs and memberships. Only write necessary reviewed additive migrations after that comparison; test backups and rollback. This repository deliberately contains NO blindly applicable new migration.

Audit and test all RLS/Storage/private-channel policies, RPC security-definer search paths and grants, membership atomicity, six-digit invite expiration/hash/rate limiting, and backend validation. Then set the review flag true and rebuild. The flag is not proof of policy security.

## 4. Auth and hosting
Configure Supabase Site URL and redirect allowlist for the deployed HTTPS origin. Signup confirmation redirects to the origin; password recovery uses `/#reset` and the SDK PASSWORD_RECOVERY event. Enable an appropriate confirmation policy and email delivery. PKCE recovery must finish in the browser holding the verifier; document cross-device limitations. Review Auth password rules and provider rate limits.

Build using the project's existing `npm run build` and serve `dist/`, including `/images/together.jpg`. Do not serve just the HTML without public assets. The supplied build tool was used for production-build verification. Vite environment variables are embedded at build time, so changing them requires rebuilding.

Google Fonts currently provides Vazirmatn and DM Sans; self-host these fonts for stricter privacy/CSP/offline deployments. All core UI has sans-serif fallbacks. Configure HTTPS, HSTS, `frame-ancestors 'none'`, nosniff, a conservative referrer policy, CSP compatible with the current single-file output, and narrowly scoped Supabase HTTP/WebSocket origins. The current single-file Vite plugin emits inline script/style; use hashes/nonces or change deployment bundling through a reviewed architecture change rather than enabling broad unsafe CSP rules.

## 5. Notifications and deletion
In-app notifications require reviewed database triggers and recipient-only RLS. Reminder scheduling requires a deployed scheduler (for example Supabase Cron calling a protected Edge Function) with deduplication and timezone-aware scheduling. No worker or background web-push delivery has been deployed here.

True background push additionally requires a service worker, user-consented push subscriptions, server-only VAPID private key, public VAPID key, a scoped push-subscription table/RLS, delivery worker and retry/dead-subscription cleanup. Never simulate it with timers.

The `delete-account` Edge Function must authenticate the JWT and require recent authentication/reauthentication, delete private data and storage files, safely dissolve/anonymize shared ownership per an agreed policy, and invoke Auth Admin deletion using a SERVER-ONLY service-role key. This function is not included/deployed as a guessed destructive implementation; reconcile the existing function or implement it after policy review.

## 6. Tests to run in a command-capable environment
- `npx tsc --noEmit`
- `npx vitest run --config vitest.config.ts`
- `npx playwright install chromium`
- `npx playwright test`

Local browser tests intentionally expect the unconfigured safe state. Run them against an unconfigured build; do not point them at a populated production account.

Remote browser suite: explicitly set `RUN_REMOTE_ACCEPTANCE=true`, `TEST_A_EMAIL`, `TEST_A_PASSWORD`, `TEST_B_EMAIL`, `TEST_B_PASSWORD`, and `E2E_BASE_URL` for a configured/reviewed deployment. Use fresh confirmed dedicated accounts that are not already coupled. Run `npx playwright test tests/browser/realtime.spec.ts --project=desktop`. This creates real test data and a real test connection. Clean up using reviewed server workflows; do not use real personal accounts.

RLS read-isolation suite: configure public key, `RUN_REMOTE_ISOLATION=true`, `TEST_A1_EMAIL/PASSWORD`, `TEST_A2_EMAIL/PASSWORD`, `TEST_B1_EMAIL/PASSWORD`, `TEST_B2_EMAIL/PASSWORD`. Two distinct dedicated couples and owned fixture rows for each table are required. Run `npx vitest run tests/remote-isolation.test.ts`. This is a limited read/private-cycle test, not a full write/Storage authorization audit.

## Current release status
Build verified. Remote services, command-run tests, browser/device QA and deployment settings are UNVERIFIED/BLOCKED as detailed in the acceptance report. Do not label the product production-complete yet.
