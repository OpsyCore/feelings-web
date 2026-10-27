# FEELINGS — workspace and security audit

## Observed starting state
Classification: **MISSING product implementation**. At the start of this continuation, the available workspace contained a React 19 / TypeScript / Vite 7 starter, Tailwind CSS 4, an App component saying “Ready to build”, and no FEELINGS components, backend, Drizzle schema, credentials, or migrations. The components/API mentioned in earlier conversation were not present in the current tool-visible workspace. No existing FEELINGS implementation was removed. The current React/Vite architecture, main entry point, utility, and Vite configuration were preserved.

Current classification: **PARTIAL — implemented web UI and guarded Supabase client integration; remote contract UNVERIFIED**. This is not a completed production relationship service.

## Verified observations
- The existing starter built successfully.
- The implemented application passed the supplied production build tool.
- File-level TypeScript diagnostics were used while editing, and reported issues were fixed. Some parallel diagnostic invocations were killed by the environment; no separate full `tsc` run has been executed.
- No `.env` credentials, existing Supabase schema export, server API, or remote administration tool were available.
- No migration or remote database change was executed.
- The adapter only accepts `https://wsyfeitsqrxmvrjrghey.supabase.co` as the configured browser backend.
- No mock users, seeded activity, invented relationship history, fake invite codes, simulated online presence, or localStorage business database exist in the implementation.
- The coffee photo is decorative editorial artwork, not a claimed user memory.

## Security review (source inspection, not penetration-test certification)
- Public key only in Vite configuration. Service-role and database credentials must never enter client code.
- `.gitignore` excludes env files, private inspection output, test reports, and build artifacts.
- Auth session persistence is handled by Supabase Auth. Its browser SDK may use browser storage for auth tokens; that is not a substitute for a backend. Appearance/language are the only application-owned cookies.
- Business data starts empty and comes only from authenticated remote queries. No optimistic “saved” records are created.
- Data access is additionally blocked until `VITE_SUPABASE_SCHEMA_REVIEWED=true`. This is a deployment guard, NOT an authorization mechanism.
- Mutation payloads are field-allowlisted; inserted user IDs are derived from authenticated identity. Shared inserts check the active couple RPC. Owner mutations filter `user_id`; care acknowledgment filters `receiver_id`.
- Reactions, membership, visibility, immutable ownership, file access, and exactly-two enforcement still require audited server policies and constraints. Client filters are defense in depth, not RLS.
- Session identity changes clear cached records. Realtime subscriptions are cleaned up on identity/couple changes.
- Rendering uses React text escaping; there is no raw HTML rendering or arbitrary SVG upload. Photos accept JPEG/PNG/WebP up to 5 MB, pending server MIME/size enforcement.
- User-facing errors are localized categories, not Postgres/Supabase traces.
- Private-cycle reads are owner-scoped even before RLS. Per-record explicit sharing is a client input; enforce it with RLS. No global cycle-sharing switch silently makes all past logs public.
- Signed private Storage URLs expire after 30 minutes. Immediate signed-URL revocation after disconnection is not guaranteed by signed URLs; choose shorter TTL or an authenticated download proxy if the product requires it.
- Account deletion invokes a server Edge Function. No browser-admin deletion exists. Server cleanup/reauthentication is not deployed or verified.
- Dependency installation reported **two advisories (one low, one high)**. Exact affected packages and remediation still need `npm audit` in a command-capable environment. Do not call the dependency audit clean.
- Production CSP, security headers, asset hosting, and rate limiting remain deployment responsibilities.

## Remote verification (2026-09-28, operator-executed read-only catalog queries)
- Confirmed: the five client RPCs exist with matching signatures; migrations 0003 and 0004 were applied remotely; an older client generation shares the schema.
- Confirmed breaking client/schema mismatches (legacy NOT NULL columns) and fixed them client-side in `enrichInsertPayload`, with unit tests.
- Confirmed RLS defects (private-mood exposure via `moods_members`, owner couple_id reassignment, reactions on private moods, missing partner cycle-read, disconnect trap) and authored reviewed migration `0006_web_reconciliation.sql`; it has NOT been applied.
- Verified 2026-09-28 (second inspection round): `anon` holds no SELECT/INSERT/UPDATE/DELETE on any table except default `profiles` grants, and RLS policies reduce anon to zero rows; `authenticated` DML grants on `invitations`, `couple_members` and `couples` are neutralized because no permissive policy exists for those commands; the five product RPCs are EXECUTE-granted to `authenticated` only (`active_couple_id` also to `anon`, harmless: it derives from auth.uid()); both storage buckets are private with size and MIME limits matching the contract.
- Verified gaps fixed by migrations: `supabase_realtime` did not publish `couple_members`, `couples`, `profiles` or `cycle_logs`, so joins, profile edits and shared cycle updates could never arrive live (0006 section G); no notification trigger existed anywhere, so in-app notifications could never fire (0007 adds preference- and locale-aware triggers); trigger functions were EXECUTE-granted to client roles (0006 section H revokes).
- Row estimates are all -1 (never analyzed / effectively empty), so adding constraints now carries no backfill risk.
- Remaining UNVERIFIED: replica identity for realtime UPDATE payloads, storage object policies beyond bucket privacy, and end-to-end notification delivery after 0007 is applied.

## Migrations applied and post-applied verification (2026-09-28)
0006, 0007 and 0008 were applied to the live project by the operator and re-verified with read-only catalog queries:
- defaults and nullability landed (moods.title/client_event_id, mood_reactions.kind, important_dates.kind/created_by, moods.couple_id nullable, profiles.birthday, theme default 'system');
- mood_reactions unique (mood_id,user_id) exists;
- trigger functions and emit_notification are no longer EXECUTE-able by anon/authenticated;
- the four *_web_update owner policies now pin couple_id to the active couple (0008; the 0006 DO block for them had silently not taken effect, caught by post-apply verification);
- all seven emit_notification triggers exist;
- supabase_realtime now publishes every table the client subscribes to;
- replica identity is default (primary key) everywhere except important_dates=full, which is sufficient for postgres_changes.
Backend contract, RLS hardening, realtime publication and notification triggers are therefore VERIFIED as applied. End-to-end realtime delivery and cross-account isolation remain UNVERIFIED until the two-browser acceptance suite is actually executed with dedicated accounts.

## Blockers
1. Missing browser publishable/anon key and configured project URL.
2. Missing read-only access to the existing remote schema, functions, policies, publication, triggers, and buckets (or a redacted inspection export).
3. Adapter/schema compatibility, RLS, invitation rate limits/atomicity, notification triggers, deletion cleanup, and Storage policies not reviewed against the real project.
4. No command execution/browser automation tool available to run standalone typecheck, Vitest, or Playwright in this session.
5. No dedicated confirmed two-/four-account credentials for remote tests.

Never change these statuses to PASS solely because the web UI builds.
