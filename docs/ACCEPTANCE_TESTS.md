# FEELINGS acceptance report

## Status vocabulary
VERIFIED: actually observed by an available tool.
UNVERIFIED: code exists but the behavior has not been executed/tested.
BLOCKED: a stated external prerequisite is missing.
NOT IMPLEMENTED: no working implementation currently exists for that part.

## Actually executed
| Check | Result |
|---|---|
| Starting workspace audit | VERIFIED: React/Vite starter, no previous FEELINGS/API/schema files present |
| Starter production build | PASS via supplied build_project tool |
| Implemented production build | PASS via supplied build_project tool |
| File-level TS/JSX diagnostics | Used while editing; reported concrete type/unused import errors fixed; some parallel checker processes were killed |
| Standalone `tsc --noEmit` | NOT RUN — no general command-execution tool available |
| Vitest unit tests | NOT RUN — suite written, not executed |
| Playwright/browser tests | NOT RUN — no browser-runner tool available |
| Remote schema/RLS/Storage inspection | VERIFIED — full catalog inspection incl. grants, publication, buckets, triggers (operator-run read-only queries, 2026-09-28) |
| Migrations 0006/0007/0008 applied | VERIFIED — applied by operator in transactions; post-apply V1-V6 catalog checks all green |
| Remote migration | NOT PERFORMED intentionally |
| Two-browser realtime test | READY TO RUN — backend configured, reviewed and migrated; still needs two dedicated confirmed test accounts |
| Four-account isolation test | BLOCKED — missing reviewed backend and dedicated fixture accounts/data |

## Implemented automated suites
- `tests/validation.test.ts`: empty and Unicode-length mood validation, critical Persian mood, email/password rules, Persian/Arabic invite normalization, both-language catalogue and invalid-date handling.
- `tests/browser/app.spec.ts`: safe no-partner home, mood selection/no fake saves, custom validation/draft preservation, main navigation, language/theme changes, record draft confirmation, calendar navigation, overflow checks at required widths.
- `tests/browser/realtime.spec.ts`: opt-in real two-context login, real invite/create/join, A sleepy -> B observes, B heart -> A observes, B mood -> A observes, B care -> A receives without reload.
- `tests/remote-isolation.test.ts`: opt-in real accounts in two distinct couples, known foreign-ID read isolation and private-cycle partner denial. This does not substitute for write/delete/Storage isolation coverage.
- `scripts/inspect-supabase.mjs`: read-only remote tables/functions/policies/publication/storage inspection guarded to the real project.

A skipped remote test means BLOCKED, never PASS. Remote fixtures are actual dedicated test accounts/records, not mock product users.

## Product checklist
All domain UI routes exist. Their remote operations remain UNVERIFIED/BLOCKED until project reconciliation.
- Auth: signup/login/forgot/recovery/confirmation/logout/session restoration client wiring present; real email/rate-limit/error behavior unverified.
- Couple: create/join, QR generation, browser-supported scanning, copy/share/deep link, disconnect confirmation present. Real six-digit code, expiry, rate limits, self-join and maximum-two are backend contract requirements, not verified implementations.
- Feelings: quick/custom <=50, save/edit/delete, history filters, visibility, reactions and own received-reaction display present. Realtime unverified.
- Care: categories, send, history, detail/recipient acknowledgment, home arrival display present. Remote delivery unverified.
- Timeline: merged bounded chronological collections and filters present; advanced pagination-preserving realtime needs improvement.
- Memories: create/edit/view/delete forms, real Storage adapter, signed images and full-size view present. Upload/row atomicity, orphan cleanup, Storage policies unverified/not deployed.
- Dates: CRUD, yearly repeat field, localized date display and countdown present.
- Calendar: Gregorian month navigation with Persian-friendly labels, real date markers, events/forms/reminder metadata. General event recurrence and reminder dispatch NOT IMPLEMENTED.
- Diary: shared CRUD forms, photo support, draft-close/refresh warning. Durable draft autosave NOT IMPLEMENTED; draft is held in memory while form is open.
- Couple care: human suggestions, mood/care links and shared diary prompt present.
- Cycle: owner list/forms, date order/length, symptoms/notes, explicit per-record sharing, private default. RLS unverified. Partner view of explicitly shared cycle records remains NOT IMPLEMENTED.
- Notifications: real-table list/read/read-all/preference adapters. Backend event triggers unverified; scheduler/background push NOT IMPLEMENTED. Badge currently counts the fetched page, not a separate all-unread aggregate.
- Profile/settings: profile/avatar operations, language/theme, notification/privacy preferences, password and deletion/disconnection confirmations. Cross-device language/theme sync and applying stored mood visibility as default remain follow-up work.
- Deletion: client calls reviewed server workflow; account deletion Edge Function/retention/cleanup NOT IMPLEMENTED in this workspace and existing remote function unknown.
- Appearance: light and dark, RTL/LTR, responsive layouts, safe loading/error/empty/offline states coded; formal visual/accessibility browser QA UNVERIFIED.

## Manual scenarios required before release
### Auth
Fresh confirmed and unconfirmed accounts; duplicate signup provider behavior; wrong password; invalid email; expired recovery; rate limits; refresh and token renewal; logout clearing data; solo user profile/history without any Couple.
### Couple integrity
Invalid/expired/used code; self-join; already connected; simultaneous joins by B/C to A's invitation; third member rejected in DB; brute-force attempt rate limit; join event seen by invite creator; disconnect revokes both users' access correctly.
### Data isolation
A1/A2 and B1/B2: direct known-ID SELECT, INSERT with spoofed couple/user IDs, UPDATE ownership, DELETE, RPC ID tampering, private moods, reactions on hidden mood, forged care recipient, private/shared cycle, notifications, private Storage objects and private realtime topic. Test both directions and denied operations through direct SDK, not just hidden buttons.
### Storage
Allowed/oversized/spoofed MIME, path traversal, foreign prefix, replaced/deleted files, expired signed URLs, revoked membership, failed-row orphan cleanup, account cleanup.
### Resilience
Network loss before/during writes; double submits; back button/draft close/refresh; reconnect without duplicated mutations; subscription failure; delete events; token refresh; partner offline then return.
### Dates/localization
Both locales, device timezones, daylight-saving transitions, date-only rendering, leap-day anniversary policy, event recurrence when added, calendar versus local input calendar.

## Release decision
**NOT COMPLETE / NOT READY FOR PRODUCTION ACCEPTANCE.** The web implementation builds, but the hard realtime/isolation tests and real backend security are blocked and have not passed. See deployment instructions for exact prerequisites.
