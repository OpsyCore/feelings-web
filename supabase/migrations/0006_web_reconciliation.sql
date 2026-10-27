-- FEELINGS web reconciliation migration.
-- Derived from the read-only catalog inspection of project wsyfeitsqrxmvrjrghey run on
-- 2026-09-28 (operator-executed SELECTs; no row data read). Every statement is additive,
-- idempotent, or a policy/function tightening that preserves existing rows. REVIEW BEFORE
-- APPLYING: this file is not applied by the source package and must be run by an operator
-- against the live project, ideally after a fresh backup.
--
-- Findings it addresses:
--  A. disconnect_couple() dissolved the couple row but left both rows in couple_members,
--     and active_couple_id() ignored couples.status/dissolved_at. Result: after
--     "disconnect" the pair still shared data through the old couple and neither could
--     ever create or join a new couple ("already in a couple" forever).
--  B. moods_members was an ALL policy on couple_id, so a partner could read, update and
--     delete the other person's visibility='private' moods (violates RLS invariants 3/7
--     in docs/DATABASE_SCHEMA.md).
--  C. Owner UPDATE policies on shared tables checked only user_id, so an owner could
--     re-point their row at a foreign couple_id and inject it into another couple's
--     shared collections (violates invariant 7).
--  D. Reaction policies matched any mood inside the active couple, including private
--     moods, and mood_reactions had no one-reaction-per-person uniqueness.
--  E. Explicitly shared cycle logs (visibility='partner') were unreadable by the partner:
--     the documented feature had no server policy.
--  F. profiles lacked the birthday column the web profile editor edits, and defaulted
--     theme to 'System' while every client compares against lowercase values.

-- A. A dissolved couple is no longer an active couple. Members are intentionally kept so
--    historical rows retain their couple_id; access disappears because every shared
--    policy resolves active_couple_id() to NULL for both people.
create or replace function public.active_couple_id()
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $$
declare
  result uuid;
begin
  select cm.couple_id into result
    from public.couple_members cm
    join public.couples c on c.id = cm.couple_id
   where cm.user_id = auth.uid()
     and c.dissolved_at is null
   limit 1;
  return result;
end;
$$;
grant execute on function public.active_couple_id() to authenticated;

-- Solo use: a person must be able to log a private mood before connecting with anyone.
alter table public.moods alter column couple_id drop not null;

-- Defaults so any client that omits the legacy columns still inserts successfully.
alter table public.moods alter column title set default '';
alter table public.moods alter column client_event_id set default gen_random_uuid();
alter table public.mood_reactions alter column kind set default 'reaction';
alter table public.important_dates alter column kind set default 'date';
alter table public.important_dates alter column created_by set default auth.uid();

-- B. Private stays private; only the owner mutates; the partner reads partner-visible rows.
drop policy if exists moods_members on public.moods;
drop policy if exists moods_partner_select on public.moods;
create policy moods_partner_select on public.moods
  for select using (couple_id = public.active_couple_id() and visibility = 'partner');
drop policy if exists moods_member_insert on public.moods;
create policy moods_member_insert on public.moods
  for insert with check (user_id = auth.uid() and couple_id = public.active_couple_id());
drop policy if exists moods_insert_own on public.moods;
create policy moods_insert_own on public.moods
  for insert with check (user_id = auth.uid() and (couple_id is null or couple_id = public.active_couple_id()));
drop policy if exists moods_update_own on public.moods;
create policy moods_update_own on public.moods
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and (couple_id is null or couple_id = public.active_couple_id()));

-- C. Owners may update their rows but never move them into another couple.
do $$
declare t text; g text;
begin
  foreach t in array array['memories','important_dates','calendar_events','diary_entries'] loop
    foreach g in array array['_update','_web_update'] loop
      execute format('drop policy if exists %I on public.%I', t || g, t);
      execute format(
        'create policy %I on public.%I for update using (user_id = auth.uid() and couple_id = public.active_couple_id()) with check (user_id = auth.uid() and couple_id = public.active_couple_id())',
        t || g, t);
    end loop;
  end loop;
end $$;

-- D. Reactions only on moods the reactor can actually see; one reaction per person per mood.
drop policy if exists reactions_insert on public.mood_reactions;
create policy reactions_insert on public.mood_reactions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.moods m
       where m.id = mood_reactions.mood_id
         and (m.user_id = auth.uid()
              or (m.couple_id = public.active_couple_id() and m.visibility = 'partner'))));
drop policy if exists reactions_select on public.mood_reactions;
create policy reactions_select on public.mood_reactions
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.moods m
       where m.id = mood_reactions.mood_id
         and m.couple_id = public.active_couple_id()
         and m.visibility = 'partner'));
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mood_reactions_mood_user_key') then
    if not exists (select 1 from public.mood_reactions group by mood_id, user_id having count(*) > 1) then
      alter table public.mood_reactions add constraint mood_reactions_mood_user_key unique (mood_id, user_id);
    end if;
  end if;
end $$;

-- E. An explicitly shared cycle log is readable by the active partner, and by nobody else.
drop policy if exists cycle_partner_shared_select on public.cycle_logs;
create policy cycle_partner_shared_select on public.cycle_logs
  for select using (user_id = auth.uid() or (visibility = 'partner' and couple_id = public.active_couple_id()));

-- F. Profile fields and defaults the web editor relies on.
alter table public.profiles add column if not exists birthday date;
alter table public.profiles alter column theme set default 'system';
update public.profiles set theme = 'system' where theme = 'System';

-- G. Realtime: postgres_changes only emits for tables in the supabase_realtime publication.
--    The live project publishes moods, mood_reactions, care_signals, memories,
--    important_dates, calendar_events, diary_entries and notifications, but NOT
--    couple_members, couples, profiles or cycle_logs. Consequence: a partner joining
--    never appeared live, profile/avatar edits never propagated, and shared cycle
--    updates never refreshed. Realtime honours RLS for authenticated subscriptions, so
--    publishing these tables leaks nothing the policies do not already allow.
do $$
declare t text;
begin
  foreach t in array array['couple_members','couples','profiles','cycle_logs'] loop
    if to_regclass('public.' || t) is not null
       and not exists (select 1 from pg_publication_tables
                        where pubname = 'supabase_realtime'
                          and schemaname = 'public'
                          and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- H. Trigger functions must not be directly callable by client roles; the trigger
--    mechanism itself does not need the EXECUTE grant.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_user_profile() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.set_updated_at_important_dates() from public, anon, authenticated;
