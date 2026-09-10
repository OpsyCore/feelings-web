# FEELINGS — native Android engineering handoff

## Read this status first
This repository is the current WEB product implementation and an explicit integration contract. It is NOT a verified complete backend source of truth yet: remote schema/RLS/Auth/Storage/Realtime are BLOCKED pending credentials and inspection. Do not assume the expected table/RPC names already match the live Supabase project. Resolve these blockers on Web and update this handoff before locking an Android production contract.

Build Android natively with Kotlin and Jetpack Compose in a later separate project. Do not attempt to convert React/CSS into an APK or package a fake Android Web wrapper. No Android code was created here.

## Product
FEELINGS · دو نفر، یک احساس · Two people, one feeling.
A private companion for two people: how I feel, how my partner feels, small care gestures, shared moments and life dates. Emotionally warm, premium, simple, non-clinical, not a public social network. No analytics dashboard, followers, likes feed or public profile discovery.

Primary locale Persian/RTL; secondary English/LTR. All application-owned text goes through the central catalogue (`src/lib/i18n.ts`). Preserve user-authored text as written. Dates are stored safely and displayed using the user's locale/timezone; date-only values are not UTC instants. The current Web calendar is Gregorian navigation with localized month/weekday labels, not a fully Jalali arithmetic calendar.

## Navigation
Five primary mobile tabs: Home, Feelings, Moments, Care, Profile. Desktop Web has a sidebar and secondary routes: Memories, Important dates, Calendar, Shared diary, Relationship care, Personal cycle, Settings. Secondary Android destinations may be nested under primary screens, but preserve discoverability and back-stack/draft behavior. There is one product and one Supabase project.

## Screen inventory / Web mapping
| Master screen family | Current Web implementation |
|---|---|
| Splash / brand | Brand and illustration within onboarding; no separate timed splash route |
| Onboarding and language selection | Three-step modal, progress dots, skip/continue; bilingual language controls |
| Login/signup/forgot/reset/confirmation | AuthDialog modes, real SDK integration; session handling in AppProvider |
| Home | Greeting, warm hero, own mood, partner/connection, care, moments, dates, daily prompt |
| Feelings/current/history/detail | FeelingsPage + MoodComposer + EntryList + EntryDetail; today/week/month/all |
| Partner/Couple profile | PartnerPage, real context, duration, mood/history, care/collection links |
| Create/join/invite QR/scanner | InviteDialog modes; no locally generated fake invitation; browser camera capability fallback |
| Care/history/detail | Category grid, actual history, detail sender/read state, recipient acknowledgment |
| Moments/timeline | Chronological merged real records with filters and shortcuts |
| Memories/add/edit/detail/photo | CollectionPage + EntryEditor + EntryDetail + private signed RemoteImage |
| Important dates/add/edit/countdown | CRUD editor and countdown cards with yearly repeat flag |
| Calendar/add/edit event | CalendarPage with month/date selection and event editor; recurrence/scheduler pending |
| Diary/add/edit/detail | Shared diary editor with optional photo and unsaved-draft protection |
| Relationship care | Human suggestions, partner feeling/care, diary prompt |
| Private cycle/detail/sharing | Owner collection, date/symptom/notes editor, explicit per-record visibility; partner shared-record view pending |
| Notifications | List, read/read-all, preferences; backend triggers unverified and push pending |
| Profile/edit/avatar | Self profile, email, birthday, real avatar operations, solo-account support |
| Settings | Appearance, language, notifications, privacy, security, Couple, about |
| Password/delete/disconnect confirmations | Password AuthDialog; typed account deletion; contextual disconnection |

These are composable screen states, not 46 unrelated duplicate pages. Dedicated loading, empty, offline, configuration-blocked, validation, permission/error and confirmation states accompany the screens. A dedicated not-found route and durable offline drafts are still follow-up work.

## Core flows
### Solo first run
With a configured backend, onboarding -> signup/login -> own home. Never force Couple creation. Own profile and feelings remain meaningful. Without configured credentials, show an explicit setup-safe shell: browsing/draft selection are possible but no write succeeds or fake session is created.

### Couple
Create invitation via authenticated RPC. Display the actual returned six digits, QR, copy/share, expiry. Join with code or scan -> explicit submit -> server validation. Exactly two, no self-join, expiry/consumption and rate limits are SERVER rules. Show the other real profile only when context returns it. Disconnection requires confirmation and server revocation; never manually delete partner data from the client.

### Feeling/reaction
Tap preset -> selected visual feedback, not yet saved. Optional custom text max 50 Unicode code points. Visibility is private by default; partner sharing requires connection. Save only shows success after remote commit. Partner receives mood; reacts from six emoji; reaction persists and appears on the author's mood. Author edit/delete and reaction-owner removal obey RLS. Current Web cached history is bounded; reconcile latest-per-member queries and pagination before Android parity work.

### Care
Choose category/gesture -> actual insert -> partner's active-page realtime and history. Recipient can acknowledge read state. Do not use local timers to pretend delivery. Read state is not partner availability.

### Memories/diary/dates/events
Edit labeled fields, validate, preserve the in-progress form after errors and protect dismissal. Photo uploads are real private Storage operations, never fake local image URLs claimed as uploaded. Both partners read shared content; creator mutates it. Deleting asks confirmation. The Web draft is memory-only while open, not durable autosave.

### Cycle privacy
Records belong to one individual and DEFAULT PRIVATE. Share each entry only with explicit consent and audited RLS. Partner-visible appearance alone is never the permission boundary. No medical/contraceptive claim. Predictions are not implemented.

## Validation
Email shape; signup/recovery passwords >=8 including Latin letter+digit and matching confirmation; six normalized decimal digits for invitation; mood <=50 Unicode code points; name <=60; title <=120; diary text <=10000; cycle symptoms <=500 and notes <=5000; cycle length 15..90; end date not before start; JPEG/PNG/WebP max5MB. Backend must independently validate all ownership, lengths and membership fields.

## Design / Compose equivalents
Consult `docs/DESIGN_SYSTEM.md` and CSS tokens. Warm ivory #faf8f5, card #fffefc, ink #39332f, coral #e97d71; dark plum #201d20, card #2a2529, text #f2e8e1, soft coral #ef9a8f. Persian Vazirmatn, English DM Sans or equivalent licensed packaged fonts. Main cards ~21dp corners, controls10–12dp, dialogs23dp. Spacing follows ~8/12/16/20/24/32 progression. Navigation icons are thin consistent outlines; emoji have restrained scale. Buttons have one clear primary action; destructive actions use a separate danger role.

Use native bidirectional layout, scalable typography, accessibility semantics, >=48dp Android hit targets, TalkBack, keyboard support where relevant, system insets and native pickers. Avoid copying tiny Web captions blindly. Light/dark are separate palettes; photography is toned in dark mode. Subtle150–300ms transitions respect reduced motion/system settings.

## Backend / ownership
Single project: https://wsyfeitsqrxmvrjrghey.supabase.co. Native app may contain only a public publishable/anon key; never service-role or database credentials. Secure Android Auth session storage, authenticated queries, recipient/owner filtering, and server authorization are required. Full contract in `docs/API_CONTRACT.md`; entity/RLS expectations in `docs/DATABASE_SCHEMA.md`.

Personal: profile, own feelings, private settings and cycle data. Shared with active couple where permitted: visible feelings/reactions, care, memories, diary, important dates and events. Notifications are recipient-owned. All UUIDs are untrusted inputs; changing IDs must never grant access. The native app must use the inspected backend, not create its own separate tables/database.

## Realtime / Storage / notifications
Private authorized topic `couple:<id>` or `user:<id>`, valid JWT, RLS-protected table events, membership/profile invalidation, cleanup on logout/disconnect. Presence must be genuine. Shared/private media buckets require prefix+membership policies and expiring signed reads. Storage orphan cleanup and delete-account workflow remain unresolved backend tasks.

Active-page realtime != background delivery. Web push is not implemented. Native push requires separate FCM token storage/RLS, user preferences, server delivery and cleanup, while retaining the same real notification model. Never derive a false delivery/read confirmation from a local animation.

## Acceptance and blockers
Read `docs/ACCEPTANCE_TESTS.md`. Only production build was actually executed successfully during this implementation session. Standalone typecheck/unit/browser suites were created but not run. The two-browser realtime and four-account isolation tests are BLOCKED, not passed. Android acceptance must repeat those tests with independent real users and native/web cross-client delivery after backend verification.

Before calling the product complete: inspect the actual schema/policies/publication/storage, reconcile the client, implement/reconcile deletion and scheduler rules, run all auth and security cases, prove exactly-two under concurrency, prove cross-couple/explicit-private isolation, verify actual mood->reaction->care realtime, and complete responsive/RTL/light/dark/accessibility QA.
