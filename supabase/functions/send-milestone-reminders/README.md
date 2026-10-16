# Scheduled milestone push reminders

This Edge Function sends Web Push notifications for due `milestone_reminders` while keeping the private VAPID credentials and Supabase service-role credential server-side.

## Required Edge Function secrets

Set these in Supabase Edge Function secrets:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `MILESTONE_CRON_SECRET`

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to hosted Edge Functions.

## Deploy

Deploy with JWT verification disabled at the platform layer because this function uses its own scheduler secret header:

```bash
supabase functions deploy send-milestone-reminders --no-verify-jwt
```

The scheduler must send:

```text
x-cron-secret: <MILESTONE_CRON_SECRET>
```

Never put the cron secret, service-role key, or VAPID private key in the React frontend.

## Frontend

The browser only needs the public VAPID key:

```text
VITE_VAPID_PUBLIC_KEY
```

The browser stores subscriptions in `milestone_push_subscriptions`.
