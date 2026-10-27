-- 0009: per-row privacy + optional photo for important_dates
-- Additive and idempotent. Apply via Supabase SQL Editor (or psql). No data is modified:
-- existing dates keep visibility='partner' (fully shared), exactly as before.

alter table public.important_dates
  add column if not exists photo_path text;

alter table public.important_dates
  add column if not exists visibility text not null default 'partner';

-- Replace ONLY the SELECT policy so a date marked 'private' is readable by its owner only.
-- Insert/update/delete policies are untouched (already verified: owner + active couple).
do $$
declare
  pol text;
begin
  select policyname into pol
    from pg_policies
   where schemaname = 'public'
     and tablename = 'important_dates'
     and cmd = 'SELECT'
   limit 1;
  if pol is not null then
    execute format('drop policy %I on public.important_dates', pol);
  end if;
  create policy important_dates_web_select
    on public.important_dates
    for select to authenticated
    using (
      couple_id = public.active_couple_id()
      and (visibility = 'partner' or user_id = auth.uid())
    );
end $$;

-- Verification (read-only):
-- select policyname, cmd from pg_policies where tablename='important_dates';
-- select column_name from information_schema.columns where table_name='important_dates' and column_name in ('visibility','photo_path');
