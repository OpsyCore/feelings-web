-- FEELINGS Web compatibility migration (applied to project wsyfeitsqrxmvrjrghey)
alter table public.profiles add column if not exists name text;
alter table public.moods add column if not exists text text;
alter table public.moods add column if not exists visibility text not null default 'private';
alter table public.mood_reactions add column if not exists emoji text;
alter table public.cycle_logs add column if not exists couple_id uuid references public.couples(id) on delete cascade;
alter table public.cycle_logs add column if not exists period_end date;
alter table public.cycle_logs add column if not exists cycle_length integer;
alter table public.cycle_logs add column if not exists symptoms text;
alter table public.cycle_logs add column if not exists visibility text not null default 'private';
alter table public.important_dates add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.important_dates add column if not exists date date;
alter table public.important_dates add column if not exists emoji text;
alter table public.important_dates add column if not exists repeat_yearly boolean not null default false;
alter table public.important_dates add column if not exists description text;
update public.profiles set name=display_name where name is null;
update public.important_dates set date=event_date where date is null;
update public.important_dates set user_id=created_by where user_id is null;
