// FEELINGS notify — Supabase Edge Function (Deno).
// Receives database-webhook POSTs (supabase_functions.http_request) on INSERT of
// shareable content, resolves the recipient partner, respects notification_preferences
// and sends encrypted Web Push to every device the recipient enabled.
// Secrets required: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:feelings@opsycore.github.io',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

const ok = (body = 'ok') => new Response(body, { status: 200 });

async function partnerOf(userId: string, coupleId?: string | null) {
  if (!coupleId) return undefined;
  const { data } = await supabase
    .from('couple_members')
    .select('user_id')
    .eq('couple_id', coupleId)
    .neq('user_id', userId)
    .limit(1);
  return data?.[0]?.user_id as string | undefined;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return ok('method');
  let payload: { type?: string; table?: string; record?: Record<string, any> };
  try {
    payload = await req.json();
  } catch {
    return ok('bad-json');
  }
  if (payload.type !== 'INSERT' || !payload.record) return ok('ignored');
  const table = payload.table ?? '';
  const record = payload.record;
  const senderId = record.user_id as string | undefined;

  let recipient: string | undefined;
  let prefKey = '';
  let body = '';
  let url = './#moments';

  if (table === 'moods') {
    if (record.visibility !== 'partner') return ok('private');
    recipient = await partnerOf(senderId!, record.couple_id);
    prefKey = 'moods'; url = './#feelings';
    body = `${record.emoji ?? '💭'} ${record.text ?? ''}`.trim();
  } else if (table === 'mood_reactions') {
    const { data: mood } = await supabase.from('moods').select('user_id').eq('id', record.mood_id).maybeSingle();
    recipient = mood?.user_id;
    prefKey = 'reactions'; url = './#feelings';
    body = `واکنش ${record.emoji ?? '❤️'} به حس تو`;
  } else if (table === 'care_signals') {
    recipient = record.receiver_id;
    prefKey = 'care'; url = './#care';
    body = `${record.emoji ?? '💌'} ${record.text ?? ''}`.trim();
  } else if (table === 'memories') {
    recipient = await partnerOf(senderId!, record.couple_id);
    prefKey = 'memories'; url = './#moments';
    body = `خاطرهٔ تازه: ${record.title ?? ''}`;
  } else if (table === 'important_dates') {
    if (record.visibility === 'private') return ok('private');
    recipient = await partnerOf(senderId!, record.couple_id);
    prefKey = 'dates'; url = './#dates';
    body = `تاریخ مهم: ${record.title ?? ''}`;
  } else if (table === 'calendar_events') {
    recipient = await partnerOf(senderId!, record.couple_id);
    prefKey = 'dates'; url = './#calendar';
    body = `قرار تازه: ${record.title ?? ''}`;
  } else if (table === 'diary_entries') {
    recipient = await partnerOf(senderId!, record.couple_id);
    prefKey = 'diary'; url = './#diary';
    body = `نوشتهٔ تازه: ${record.title ?? ''}`;
  } else {
    return ok('unknown-table');
  }

  if (!recipient || recipient === senderId) return ok('no-recipient');

  const { data: pref } = await supabase
    .from('notification_preferences')
    .select('moods,reactions,care,dates,memories,diary')
    .eq('user_id', recipient)
    .maybeSingle();
  if (pref && (pref as Record<string, boolean>)[prefKey] === false) return ok('muted');

  const { data: sender } = await supabase.from('profiles').select('name').eq('id', senderId).maybeSingle();
  const title = `${sender?.name ?? 'همراهت'} · فیلینگز`;

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id,endpoint,p256dh,auth')
    .eq('user_id', recipient);

  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, tag: `${table}-${record.id}`, url }),
        { TTL: 60 * 60 * 12 },
      );
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
      }
    }
  }
  return ok('sent');
});
