# FEELINGS API contract — client expectation, NOT a verified remote schema

All APIs target the single project `wsyfeitsqrxmvrjrghey`. The current remote tables/functions have not been inspected. Reconcile this contract with the existing schema before enabling data operations. Do not blindly create matching tables in an unrelated database.

## Authentication
Supabase JS v2 Auth: `signUp({email,password,options:{data:{name},emailRedirectTo}})`, `signInWithPassword`, `resetPasswordForEmail`, `updateUser({password})`, `signOut`, `getSession`, `getUser`, and `onAuthStateChange`.

Auth creates independent accounts; no Couple is required. Signup uses a name, email, matching passwords, minimum eight characters including a Latin letter and digit. Password recovery reacts to PASSWORD_RECOVERY. Duplicate-account obfuscation may cause a confirmation screen instead of a duplicate-account error, depending on project settings. Sessions persist through Supabase SDK storage, not fabricated local users.

## Read context
`get_my_couple()` takes no caller-controlled user ID; derives `auth.uid()` and returns null or:
- `id: uuid`
- `created_at: timestamptz`
- `relationship_date?: date`
- `partner?: {id, name, avatar_path?, birthday?}` (only partner-safe profile fields)

The caller separately queries its own `profiles` row by `id=auth.uid()`. Partner private settings, email, and cycle notes must NOT appear in the context RPC. Return an object, not an array, or adapt the frontend after inspection.

## CRUD
The adapter uses authenticated PostgREST requests with a table allowlist from `src/lib/types.ts`. Reads are ordered by `created_at DESC` and range-paginated in batches of 30. Notification reads are owner-only. Cycle reads currently return only the owner’s logs. Moods include the owner’s records plus partner-visible records in the active Couple. Other shared collections are filtered by active `couple_id`.

Mutations return the actual saved row before the UI shows success. Ownership is derived from `getUser()`, never accepted from a form. Shared inserts validate the active context. Updates/deletes additionally filter owner ID; care acknowledgment filters receiver ID. Every operation still needs RLS and immutable ownership constraints on the server.

Payload fields:
- moods: `text, emoji, visibility` (+ derived owner/couple on insert)
- mood_reactions: `mood_id, emoji` (+ derived owner/couple)
- care_signals insert: `signal, emoji, text, receiver_id`; acknowledgment: `read_at` only
- memories: `title, description, date, photo_path, location`
- important_dates: `title, date, emoji, repeat_yearly, description`
- calendar_events: `title, date, time, reminder_minutes, description`
- diary_entries: `title, body, date, photo_path`
- cycle_logs: `period_start, period_end, cycle_length, symptoms, notes, visibility`

A backend should not let a reaction creator react to themselves, spoof another couple, or react to a private mood. Enforce unique `(mood_id,user_id)` and delete through owner-only permission. Care sender must be an active member and recipient must be the other active member; only recipient changes read state.

## Invitations (real codes only)
`create_couple_invitation()` -> `{code: six-digit string, expires_at: ISO timestamp}`. It must create or reuse the caller’s eligible empty Couple transactionally. The UI refreshes the context after creation. Return no code if the operation fails. Store a secure hash/token server-side rather than exposing all active invites via SELECT.

`join_couple({invite_code: normalized six-digit string})` -> success or a friendly categorized error. Validate authenticated caller, expiry, one-time use, self-join, already-connected status and maximum two members under a database lock/transaction. Protect creation and failed joins with server-side rate limits. Six digits alone provide insufficient brute-force resistance.

`disconnect_couple()` -> success, atomically revoking shared access/membership according to the reviewed retention policy. The browser does not individually delete partner records.

Invitation URLs use `/?invite=123456`; the UI pre-fills but does NOT auto-join. Native BarcodeDetector scanning is available only on compatible HTTPS browsers; unsupported/denied camera states explain the manual-code fallback. Same-origin invitation URLs or raw six-digit codes are accepted; all final validation remains server-side.

## Preferences and profile
`profiles` upsert is self-scoped. Name max 60, optional birthday, private avatar path. Appearance/language currently persist as minimal preference cookies on the device; profile language/theme fields exist in the expected schema but cross-device synchronization is pending.

`notification_preferences` fields: `moods, reactions, care, dates, memories, diary`. `privacy_settings`: `mood_visibility`. Both are user-owned upserts. Cycle privacy is per-record and defaults private; the UI has no bulk-sharing control. Current mood composer still defaults private for safety; applying stored preference as a default remains a follow-up integration task.

`notifications` are inserted by trusted backend triggers only. Client can mark own `read_at`; it must not create arbitrary notification content.

## Storage
Private buckets expected: `avatars`, `couple-media`. Paths: avatar `<user_id>/<user_id>/<random UUID>.<ext>`, shared media `<couple_id>/<creator_id>/<random UUID>.<ext>`. Real SDK upload, no fake progress/URLs. Accepted images: JPEG, PNG, WebP, max 5 MB. Server bucket rules and MIME checks must match. Read with signed URLs, TTL 1800 seconds. Membership/ownership and the appropriate object prefix must be enforced by Storage RLS. Upload-to-row failure can leave an orphan; server-side orphan cleanup/row deletion cleanup remains required.

## Account deletion
Authenticated Edge Function `delete-account`, request `{confirmation:'DELETE'}`. Must independently verify JWT, recent auth, CSRF/origin policy where applicable, and exact confirmation. Admin key stays only in the function secret store. Full account/private-data/storage cleanup and safe shared-data retention require an agreed policy. The client invokes the endpoint, but no guessed destructive Edge Function has been deployed or verified.

## Errors
Error categories are localized. Known mappings cover invalid credentials, unconfirmed email, rate limit, permission, duplicate, invalid/expired invitation, full Couple, self join, already connected, connectivity and generic failure. No raw remote response is rendered to users. RPC implementations should use stable codes; reconcile existing remote errors before enabling the integration.
