import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const cronSecret = Deno.env.get("MILESTONE_CRON_SECRET");
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:family-archive@example.com";

if (!supabaseUrl || !serviceRoleKey || !cronSecret || !vapidPublicKey || !vapidPrivateKey) {
  throw new Error("Missing required milestone reminder function secrets.");
}

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
const supabase = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  if (req.headers.get("x-cron-secret") !== cronSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  const now = new Date().toISOString();
  const { data: reminders, error: reminderError } = await supabase
    .from("milestone_reminders")
    .select("id, milestone_id, title, note, remind_at, remind_user_id")
    .is("completed_at", null)
    .lte("remind_at", now)
    .order("remind_at", { ascending: true })
    .limit(100);

  if (reminderError) {
    return Response.json(
      { error: reminderError.message },
      { status: 500, headers: corsHeaders },
    );
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const reminder of reminders || []) {
    const { data: subscriptions, error: subscriptionError } = await supabase
      .from("milestone_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", reminder.remind_user_id);

    if (subscriptionError) {
      failed += 1;
      continue;
    }

    if (!subscriptions?.length) {
      skipped += 1;
      continue;
    }

    let reminderSent = 0;

    for (const subscription of subscriptions) {
      const { data: claim, error: claimError } = await supabase
        .from("milestone_reminder_deliveries")
        .insert({
          reminder_id: reminder.id,
          subscription_id: subscription.id,
        })
        .select("id")
        .single();

      if (claimError || !claim) {
        continue;
      }

      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify({
            title: reminder.title || "Family Archive reminder",
            body: reminder.note || "A family milestone reminder is due.",
            tag: `family-archive-reminder-${reminder.id}`,
            reminderId: reminder.id,
            milestoneId: reminder.milestone_id,
            url: "/?screen=milestones",
          }),
          { TTL: 86400 },
        );

        await supabase
          .from("milestone_reminder_deliveries")
          .update({ delivered_at: new Date().toISOString() })
          .eq("id", claim.id);

        reminderSent += 1;
        sent += 1;
      } catch (pushError) {
        failed += 1;
        await supabase
          .from("milestone_reminder_deliveries")
          .delete()
          .eq("id", claim.id);

        const statusCode = pushError?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from("milestone_push_subscriptions")
            .delete()
            .eq("id", subscription.id);
        }
      }
    }

    if (reminderSent > 0) {
      await supabase
        .from("milestone_reminders")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", reminder.id);
    }
  }

  return Response.json(
    {
      success: true,
      processed: reminders?.length || 0,
      sent,
      skipped,
      failed,
    },
    { headers: corsHeaders },
  );
});
