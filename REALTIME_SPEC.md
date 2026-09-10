# FEELINGS Realtime

**Status: client subscription code implemented; remote policies/publication/triggers and delivery BLOCKED/UNVERIFIED. No two-browser PASS has been observed.**

## Subscription lifecycle
Only start when an actual Supabase session exists and the schema-review deployment gate is true. Use the authenticated JWT. Topic is `couple:<uuid>` for a connected user, otherwise `user:<uuid>`, with `config.private=true` and presence keyed by the authenticated user ID. On identity or Couple changes, remove the old channel and clear old cached data. Refresh authorized records after successful mutations, after realtime changes, on connectivity restoration and on window focus.

Tables: moods, mood_reactions, care_signals, memories, important_dates, calendar_events, diary_entries, cycle_logs, notifications. Couple-owned table subscriptions filter active couple_id. Private cycle/notifications use user_id. An additional owner mood subscription keeps personal moods in sync. Membership and profile changes also trigger revalidation. Event-driven revalidation is debounced 150 ms; it is NOT simulated polling.

Channel join authorization must be enforced by `realtime.messages` RLS against active membership. Postgres Changes additionally uses each table's SELECT RLS. Do not depend on a secret-looking channel name or a client filter to isolate users.

## Visible updates
- Partner mood appears in the partner card without refreshing the document.
- Own mood's received reactions appear in `.my-reactions`.
- Received care appears in `.care-arrival` and Care history.
- Collection updates are reflected by authenticated re-query.
- Read states and notification badges derive from actual rows.
- Presence only says online after a successfully subscribed real channel reports that partner key. If the channel is unavailable, the UI says presence unavailable, not falsely offline/online.

## Publication and deletion concerns
The project must publish the relevant tables and permit Realtime access through audited policies. Verify Supabase's current filtered DELETE behavior and replica identity against the deployed version. The client also listens for an authorized private broadcast event named `changed`; use reviewed backend triggers/RPCs to broadcast it after collection deletes, membership changes and visibility revocation. Payload should contain only an invalidation marker, not private row content. No such trigger has been deployed here.

A client re-query replaces the current bounded collection page; advanced pagination-preserving realtime merging remains an improvement. The current 30-record context can omit an older partner mood if one person creates many newer rows; a dedicated latest-per-member RPC/query should be added during schema reconciliation.

## Hard acceptance sequence
Use `tests/browser/realtime.spec.ts` with actual dedicated accounts and explicit opt-in. It creates an invitation via the UI, joins the second account, then observes:
1. A saves shared `🥱 خوابم میاد`.
2. B's partner card shows it without reload.
3. B reacts `❤️`.
4. A's own feeling shows that reaction without reload.
5. B changes to happy; A sees it without reload.
6. B sends water care; A receives it on home without reload.

The test uses two independent browser contexts, real login and real Supabase calls. No intercepts, fake channels, mock accounts or synthetic success timers are used. Never mark it PASS when skipped. Also manually check reverse directions, reconnect, token refresh, background tab behavior and member removal.

## Notification scope
In-app notification rows require real backend triggers respecting stored preferences. Background reminders need a scheduler. Web push needs service worker + server VAPID + permission/subscription lifecycle and is not implemented. These are separate from active-page Realtime and cannot be claimed working because a toast renders.
