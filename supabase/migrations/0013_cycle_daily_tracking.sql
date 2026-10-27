-- Professional per-day cycle tracking. Apply once in Supabase SQL Editor.
create table if not exists public.cycle_daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid references public.couples(id) on delete set null,
  log_date date not null,
  flow text not null default 'none' check (flow in ('none','spotting','light','medium','heavy')),
  pain smallint not null default 0 check (pain between 0 and 10),
  energy smallint not null default 5 check (energy between 0 and 10),
  mood text,
  symptoms text[] not null default '{}',
  sleep_hours numeric(3,1) check (sleep_hours between 0 and 24),
  medicines text,
  notes text,
  visibility text not null default 'private' check (visibility in ('private','partner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, log_date)
);
create index if not exists cycle_daily_logs_user_date_idx on public.cycle_daily_logs(user_id, log_date desc);
alter table public.cycle_daily_logs enable row level security;
drop policy if exists cycle_daily_owner_all on public.cycle_daily_logs;
create policy cycle_daily_owner_all on public.cycle_daily_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (couple_id is null or couple_id = public.active_couple_id()));
drop policy if exists cycle_daily_partner_select on public.cycle_daily_logs;
create policy cycle_daily_partner_select on public.cycle_daily_logs for select
  using (couple_id = public.active_couple_id() and visibility = 'partner');

grant select,insert,update,delete on public.cycle_daily_logs to authenticated;

create table if not exists public.cycle_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  period_reminder boolean not null default false,
  reminder_days_before smallint not null default 2 check (reminder_days_before between 0 and 7),
  daily_checkin_reminder boolean not null default false,
  reminder_time time not null default '20:00',
  partner_default boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.cycle_settings enable row level security;
drop policy if exists cycle_settings_owner_all on public.cycle_settings;
create policy cycle_settings_owner_all on public.cycle_settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select,insert,update,delete on public.cycle_settings to authenticated;
