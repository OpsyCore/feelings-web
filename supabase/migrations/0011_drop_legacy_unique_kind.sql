-- 0011: drop the legacy UNIQUE(couple_id, kind) on important_dates.
--
-- The old mobile schema allowed at most ONE date per kind per couple. The web client
-- fills the legacy kind column deterministically with 'date' (see enrichInsertPayload),
-- so after the first saved date every further insert failed with SQLSTATE 23505
-- ("duplicate key ... important_dates_unique_kind_per_couple") no matter how different
-- the titles/dates were. Real duplicates are instead prevented product-side (friendly
-- 23505 toast) and remain harmless if a user intentionally saves two identical dates.
-- The other unique constraints found in the live project (mood_reactions per mood+user,
-- moods client_event_id) match current product semantics and are intentionally kept.
-- Idempotent, no data touched.

alter table public.important_dates
  drop constraint if exists important_dates_unique_kind_per_couple;

-- Verification (read-only):
-- select conname from pg_constraint
--  where conrelid = 'public.important_dates'::regclass and contype = 'u';
