import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:family-archive@example.com';

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const auth = req.headers.get('Authorization') || '';
  if (auth !== `Bearer ${serviceRoleKey}`) return new Response('Unauthorized', { status: 401 });

  const now = new Date().toISOString();
  const { data: reminders, error } = await supabase
    .from('milestone_reminders')
    .select('id, milestone_id, title, note, remind_at, remind_user_id')
    .is('completed_at', null)
    .lte('remind_at', now)
    .order('remind_at', { ascending: true })
    .limit(100);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let sent = 0, skipped = 0, failed = 0;
  for (const reminder of reminders || []) {
    const { data: subscriptions } = await supabase
      .from('milestone_push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', reminder.remind_user_id);

    for (const subscription of subscriptions || []) {
      const { data: claim, error: claimError } = await supabase
        .from('milestone_reminder_deliveries')
        .insert({ reminder_id: reminder.id, subscription_id: subscription.id })
        .select('id')
        .single();
      if (claimError || !claim) { skipped++; continue; }

      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          JSON.stringify({
            title: reminder.title,
            body: reminder.note || 'A family milestone reminder is due.',
            tag: `family-archive-reminder-${reminder.id}`,
            reminderId: reminder.id,
            url: '/?page=milestones',
          }),
          { TTL: 86400 }
        );
        await supabase.from('milestone_reminder_deliveries').update({ delivered_at: new Date().toISOString() }).eq('id', claim.id);
        sent++;
      } catch (pushError) {
        failed++;
        await supabase.from('milestone_reminder_deliveries').delete().eq('id', claim.id);
        const status = pushError?.statusCode;
        if (status === 404 || status === 410) {
          await supabase.from('milestone_push_subscriptions').delete().eq('id', subscription.id);
        }
      }
    }
  }

  return Response.json({ ok: true, processed: reminders?.length || 0, sent, skipped, failed, at: now });
});
