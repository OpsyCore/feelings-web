-- FEELINGS repair migration: owner UPDATE policies of the web generation.
-- After applying 0006, verification showed the four `*_web_update` policies still carried
-- their old definition (WITH CHECK user_id = auth.uid() only), i.e. the DO block in 0006
-- section C did not take effect on the live project while the rest of 0006 did. With the
-- old definition an owner can UPDATE their own row's couple_id into a foreign couple and
-- inject it into that couple's shared collections (RLS invariant 7).
-- This file repeats the replacement using plain statements only, no DO block, so any
-- runner applies it statement by statement. Idempotent: drop-then-create.

drop policy if exists memories_web_update on public.memories;
create policy memories_web_update on public.memories
  for update using (user_id = auth.uid() and couple_id = public.active_couple_id())
  with check (user_id = auth.uid() and couple_id = public.active_couple_id());

drop policy if exists important_dates_web_update on public.important_dates;
create policy important_dates_web_update on public.important_dates
  for update using (user_id = auth.uid() and couple_id = public.active_couple_id())
  with check (user_id = auth.uid() and couple_id = public.active_couple_id());

drop policy if exists calendar_events_web_update on public.calendar_events;
create policy calendar_events_web_update on public.calendar_events
  for update using (user_id = auth.uid() and couple_id = public.active_couple_id())
  with check (user_id = auth.uid() and couple_id = public.active_couple_id());

drop policy if exists diary_entries_web_update on public.diary_entries;
create policy diary_entries_web_update on public.diary_entries
  for update using (user_id = auth.uid() and couple_id = public.active_couple_id())
  with check (user_id = auth.uid() and couple_id = public.active_couple_id());
