# Database contract and inspection plan

**Status: remote schema inspection BLOCKED. No database migration was generated or applied.** These are the current client expectations, not a claim that the real project already has these definitions.

Use `scripts/inspect-supabase.mjs` with a server-only DATABASE_URL belonging to FEELINGS. Review the output against this inventory. Preserve the existing schema/data and adapt names where possible. Add only compatible version-controlled migrations after review.

## Relational inventory
Common record fields: UUID `id` primary key, UUID `user_id` creator/owner reference to Auth/profile, nullable/required UUID `couple_id` as appropriate, UTC `created_at`, trigger-maintained `updated_at`. Ownership and Couple links must not be mutable by an arbitrary client update.

| Entity | Expected fields beyond common | Authorization/constraints |
|---|---|---|
| profiles | id equals auth.uid, name <=60, avatar_path nullable, birthday optional, language/theme optional | Self edit; partner-safe select only for active partner; no public directory |
| couples | id, created_at, relationship_date optional | Active members only; deletion policy reviewed |
| couple_members | user_id, couple_id, joined_at | One active Couple per person, exactly two max via serialized RPC, FK constraints |
| moods | text <=50 Unicode code points, emoji, visibility private/partner | Owner read/write, partner read only explicit shared + active membership |
| mood_reactions | mood_id, emoji in six-item set, user_id, couple_id | Unique mood/user; only the other member of a shared mood can react |
| care_signals | signal, text, emoji, sender_id, receiver_id, read_at nullable | user_id=sender_id; sender/recipient in same active Couple; recipient-only acknowledgment |
| memories | title <=120, description, photo_path optional, date, location optional | Both members read, creator edits/deletes |
| important_dates | title, date, emoji, repeat_yearly boolean, description | Both read, creator mutation |
| calendar_events | title, date, time, reminder_minutes, description | Both read, creator mutation; reminder worker needed |
| diary_entries | title, body <=10000, date, photo_path optional | Both read, creator mutation |
| cycle_logs | period_start, period_end nullable, cycle_length 15..90, symptoms <=500, notes <=5000, visibility private/partner | DEFAULT private; owner writes; only explicitly shared entries may be read by active partner |
| notifications | user_id recipient, title/text/type, created_at, read_at, authorized target identifier if present | Recipient SELECT/read-state UPDATE; trusted inserts only |
| notification_preferences | user_id PK, moods/reactions/care/dates/memories/diary booleans | Owner-only |
| privacy_settings | user_id PK, mood_visibility private/partner | Owner-only; no unconsented cycle bulk share |
| invitations (server-internal) | creator/couple, token hash/code hash, expiry, consumed_at | RPC-only; revoked after use; rate-limit attempts |
| invitation_attempts (or equivalent) | actor/key, window timestamps/counters | Server-only; bounded retention; cannot be bypassed by client writes |

Foreign keys should protect cross-couple relationships (for example reaction mood/couple consistency), not just independent valid IDs. Membership changes and invitation consumption must be atomic. Direct client INSERT/DELETE on couple_members should be denied.

## RLS invariants — status after 0006/0007/0008 (applied 2026-09-28)
1-2, 4, 5, 7, 8: enforced by verified policies (private-mood exposure, couple_id reassignment and reaction-on-private-mood holes closed; anon reduced to zero rows).
3: enforced, and the explicit-share clause for cycle logs now exists (cycle_partner_shared_select).
6: profiles partner read exposes only name/avatar/locale/theme/birthday; no email anywhere in joins.
9: realtime subscriptions are RLS-filtered; publication now covers all subscribed tables.
10: membership dissolution now propagates through active_couple_id(); signed-URL revocation after expiry remains a known limitation.

## RLS invariants to prove
1. `auth.uid()` is required for all personal/shared data; anonymous reads/writes are denied.
2. A1/A2 cannot select, insert into, update, delete, or subscribe to B1/B2 content by ID manipulation.
3. Private moods and cycle logs are unreadable even by the actual partner.
4. `visibility=partner` is insufficient without active membership in that exact couple.
5. Private settings and notifications are user-only.
6. For profile reads, do not expose email/private data through a broadly granted relationship join or security-definer RPC.
7. Owner/couple IDs cannot be reassigned on UPDATE. Check both USING and WITH CHECK policies.
8. Only the recipient may acknowledge care. Only the reaction owner may delete/update their reaction.
9. RLS also protects authenticated Realtime subscriptions. Topic names and client filters are not security boundaries.
10. Revoked membership immediately blocks new reads/writes/subscriptions and new signed URLs. Existing signed URLs survive until expiry unless a proxy/revocation mechanism is used.

Do not implement recursive member policies that cause recursion or accidentally bypass RLS through security-definer functions. Audit function search_path, grants and caller derivation. Prefer well-indexed, bounded membership predicates with carefully scoped privileges.

## Indexes and integrity
Expected index candidates: active couple_members(user_id) unique; couple_members(couple_id); moods(user_id,created_at desc), moods(couple_id,created_at desc); other shared tables(couple_id,created_at desc); cycle_logs(user_id,period_start desc); notifications(user_id,read_at,created_at desc); reactions(mood_id,user_id) unique; event/date indexes for scheduling. Add timestamp/length/date-order/check constraints and explicit FK delete behavior.

Avoid giant JSON blobs for the core relational entities. Invitations may return a JSON object from an RPC; that does not replace relational tables.

## Storage/Realtime inspection
Inspect storage.buckets privacy, size and MIME limits; storage.objects policies for SELECT/INSERT/UPDATE/DELETE; realtime.messages policies for private topic membership; supabase_realtime publication membership; replica identity; notification/broadcast triggers. Do not toggle publication tables or create buckets blindly.

## Verified remote state (read-only catalog inspection, 2026-09-28)
The web client calls five Postgres functions. **None of them is defined by any migration in this repository**, and `supabase/migrations/0003_web_completion.sql` defines one function (`public.get_my_couple()`) that the client never calls.

| Function the client calls | Called from | Defined in this repo |
|---|---|---|
| `active_couple_id()` | `getContext`, `saveEntry`, `uploadImage` | no |
| `create_couple()` | `createInvitation` | no |
| `join_couple(p_code)` | `joinInvitation` | no |
| `disconnect_couple()` | `disconnectCouple` | no |
| `delete_my_account()` | `deleteAccount` | no |

Consequences, in order of likelihood:
1. If `public.active_couple_id()` does not exist on the remote project, **every** `refresh()` fails at its first RPC call. The user-visible symptom is a failing home screen right after login — not an auth bug.
2. `0003` cannot even be applied in that case: five of its RLS policies call `public.active_couple_id()`, and Postgres validates the expression when the policy is created.
3. `docs/API_CONTRACT.md` names the same operations differently (`get_my_couple()`, `create_couple_invitation()`, `join_couple({invite_code})`) and describes account deletion as an Edge Function, while `src/lib/backend.ts` calls `rpc('delete_my_account')`. The document and the code disagree; reconcile both against the live project, not against each other.

The inspection resolved the question: **all five functions exist on the remote project** with the signatures the client uses (`join_couple(p_code text)` included), all SECURITY DEFINER except `get_my_couple()`. The remote also carries an older client generation (`quick_signals`, `care_settings`, `moods.client_event_id`, `important_dates.kind/created_by`, `mood_reactions.kind`) whose NOT NULL columns the web payloads never sent, so web inserts failed at the database. The web client now fills those legacy columns on insert (`enrichInsertPayload`), and `supabase/migrations/0006_web_reconciliation.sql` adds defaults plus the server-side fixes below. 0006 is reviewed, additive and idempotent, and is NOT applied by this package.

Verified remote defects fixed by 0006 (pending application):
- `active_couple_id()` ignored `couples.dissolved_at`, and `disconnect_couple()` keeps both membership rows, so after a disconnect the pair kept sharing data and could never couple again.
- `moods_members` was an ALL policy on `couple_id`: a partner could read, update and delete the other person's `visibility='private'` moods (invariants 3 and 7).
- Owner UPDATE policies on `memories`, `important_dates`, `calendar_events`, `diary_entries` checked only `user_id`, allowing an owner to re-point a row into a foreign couple (invariant 7).
- Reaction policies matched private moods of the couple; `mood_reactions` had no per-person uniqueness (invariant 8 / API contract).
- Explicitly shared cycle logs had no partner-read policy, so the documented feature could not work (invariant 3's explicit-share clause).
- `profiles` lacked `birthday` (the web editor edited it into nowhere) and defaulted `theme` to `'System'` while clients compare lowercase values.

Still UNVERIFIED from that inspection: table/function GRANTs for `anon` (the grant query errored and has not been re-run), `supabase_realtime` publication membership, storage bucket privacy, and notification triggers. The in-app probe (Settings → Backend / اتصال سرور) covers tables/columns/functions/buckets from a browser and never invokes an RPC.

## Known unfinished contract areas
- Existing remote names, functions, policy behavior and populated data are unknown.
- Account/shared-data deletion retention rules need explicit review and a transaction/cleanup design.
- Storage orphan cleanup and immediate URL revocation policy need implementation/reconciliation.
- General event recurrence and a reminders worker are not implemented.
- The current owner-cycle collection does not expose a partner's explicitly shared cycle logs in a partner view.
- No RLS mutation or Storage isolation suite has been executed; the included remote suite covers only known-ID reads and a private-cycle read.
