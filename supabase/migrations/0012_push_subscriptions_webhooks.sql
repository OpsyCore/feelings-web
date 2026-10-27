-- 0012: web push subscriptions + database webhooks to the notify edge function.
-- Device subscriptions are owned by the signed-in user (RLS owner-only).
-- The triggers forward INSERTs of shareable content to our own edge function
-- /functions/v1/notify which decides the recipient, respects notification_preferences
-- and delivers an encrypted Web Push to the partner's devices. Idempotent, no data touched.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_owner_select on public.push_subscriptions;
create policy push_owner_select on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
drop policy if exists push_owner_insert on public.push_subscriptions;
create policy push_owner_insert on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists push_owner_delete on public.push_subscriptions;
create policy push_owner_delete on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- Database webhooks via pg_net (the project has no supabase_functions schema):
-- a security-definer trigger function POSTs the inserted row to our edge function.
create extension if not exists pg_net;

create or replace function public.notify_webhook() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url => 'https://wsyfeitsqrxmvrjrghey.supabase.co/functions/v1/notify',
    body => jsonb_build_object('type', tg_op, 'table', tg_table_name, 'record', to_jsonb(new)),
    headers => jsonb_build_object('Content-Type', 'application/json')
  );
  return new;
end; $$;

do $$
declare
  t text;
begin
  foreach t in array array['moods','mood_reactions','care_signals','memories','important_dates','calendar_events','diary_entries'] loop
    execute format('drop trigger if exists notify_%I_insert on public.%I', t, t);
    execute format('create trigger notify_%I_insert after insert on public.%I for each row execute procedure public.notify_webhook()', t, t);
  end loop;
end $$;

-- Verification (read-only):
-- select tgname from pg_trigger where tgname like 'notify_%';
-- select policyname, cmd from pg_policies where tablename='push_subscriptions';
