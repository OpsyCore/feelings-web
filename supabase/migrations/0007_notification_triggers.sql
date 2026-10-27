-- FEELINGS in-app notification triggers.
-- The live project has the notifications table, recipient-only RLS and a realtime
-- publication for it, but nothing ever inserted a row: the inspection found a single
-- trigger in the whole schema (important_dates updated_at). docs/API_CONTRACT.md requires
-- notifications to be written by trusted backend triggers only, honouring
-- notification_preferences. This migration implements exactly that, bilingually, using the
-- recipient's stored locale. Additive and idempotent; NOT applied by this source package.
--
-- Events covered (recipient is always the other member of the active couple, never the
-- actor): care signal received, reaction received on my mood, partner-visible mood saved,
-- new shared memory, new shared diary page, new important date, new calendar event.
-- Preference keys map to notification_preferences columns: care, reactions, moods,
-- memories, diary, dates. A missing preference row means "on", matching the client default.

create or replace function public.emit_notification()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  recipient uuid;
  pref_key  text;
  locale    text;
  title     text;
  body      text;
  enabled   boolean;
begin
  case tg_table_name
    when 'care_signals' then
      recipient := new.receiver_id;
      pref_key  := 'care';
    when 'mood_reactions' then
      select m.user_id into recipient from public.moods m where m.id = new.mood_id;
      pref_key := 'reactions';
    when 'moods' then
      if coalesce(new.visibility, 'private') <> 'partner' then return null; end if;
      select cm.user_id into recipient
        from public.couple_members cm
       where cm.couple_id = new.couple_id and cm.user_id <> new.user_id
       limit 1;
      pref_key := 'moods';
    when 'memories' then
      select cm.user_id into recipient
        from public.couple_members cm
       where cm.couple_id = new.couple_id and cm.user_id <> new.user_id
       limit 1;
      pref_key := 'memories';
    when 'diary_entries' then
      select cm.user_id into recipient
        from public.couple_members cm
       where cm.couple_id = new.couple_id and cm.user_id <> new.user_id
       limit 1;
      pref_key := 'diary';
    when 'important_dates' then
      select cm.user_id into recipient
        from public.couple_members cm
       where cm.couple_id = new.couple_id and cm.user_id <> new.user_id
       limit 1;
      pref_key := 'dates';
    when 'calendar_events' then
      select cm.user_id into recipient
        from public.couple_members cm
       where cm.couple_id = new.couple_id and cm.user_id <> new.user_id
       limit 1;
      pref_key := 'dates';
    else
      return null;
  end case;

  if recipient is null or recipient = new.user_id then return null; end if;

  select case pref_key
           when 'care'      then p.care
           when 'reactions' then p.reactions
           when 'moods'     then p.moods
           when 'memories'  then p.memories
           when 'diary'     then p.diary
           when 'dates'     then p.dates
         end
    into enabled
    from public.notification_preferences p
   where p.user_id = recipient;
  if enabled is null then enabled := true; end if;
  if not enabled then return null; end if;

  select coalesce(p.locale, 'fa') into locale from public.profiles p where p.id = recipient;
  if locale is distinct from 'en' then locale := 'fa'; end if;

  case pref_key
    when 'care' then
      title := case locale when 'en' then 'A little care arrived' else 'یه مراقبت کوچیک رسید' end;
      body  := coalesce(new.text, new.signal);
    when 'reactions' then
      title := case locale when 'en' then 'A reaction to your feeling' else 'واکنشی به احساس تو' end;
      body  := new.emoji;
    when 'moods' then
      title := case locale when 'en' then 'A new feeling from your person' else 'حالِ تازه از همراهت' end;
      body  := new.text;
    when 'memories' then
      title := case locale when 'en' then 'A new memory together' else 'یه خاطرهٔ تازه دونفره' end;
      body  := new.title;
    when 'diary' then
      title := case locale when 'en' then 'A new page in our diary' else 'صفحهٔ تازه در دفتر دونفره' end;
      body  := new.title;
    else
      title := case locale when 'en' then 'A new date in your world' else 'یه تاریخ تازه در دنیای دونفره' end;
      body  := new.title;
  end case;

  insert into public.notifications (user_id, title, text, type, target_id)
  values (recipient, title, body, pref_key, new.id);
  return null;
end;
$$;

revoke execute on function public.emit_notification() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['care_signals','mood_reactions','moods','memories','diary_entries','important_dates','calendar_events'] loop
    execute format('drop trigger if exists emit_notification_%I on public.%I', t, t);
    execute format(
      'create trigger emit_notification_%I after insert on public.%I for each row execute function public.emit_notification()',
      t, t);
  end loop;
end $$;
