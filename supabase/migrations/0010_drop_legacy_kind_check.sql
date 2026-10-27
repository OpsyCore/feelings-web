-- 0010: drop the legacy CHECK on important_dates.kind that blocks web inserts.
--
-- The live table predates the web client and was created by an older schema with
--   constraint important_dates_kind_check   (check on the legacy "kind" column)
-- The web client fills kind deterministically ('date', see enrichInsertPayload in
-- src/lib/backend.ts) because the column is legacy NOT NULL; that value is not in the
-- old allow-list, so every insert failed with SQLSTATE 23514 even though all product
-- fields were valid. The column itself stays (legacy compatibility); only the stale
-- allow-list constraint goes. Idempotent, no data touched.

alter table public.important_dates
  drop constraint if exists important_dates_kind_check;

-- Verification (read-only):
-- select conname from pg_constraint
--  where conrelid = 'public.important_dates'::regclass and contype = 'c';
