# Scheduled milestone push reminders

This Edge Function sends Web Push notifications for due `milestone_reminders`, even when the Family Archive tab is closed.

## Deploy

Set these Edge Function secrets:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (for example `mailto:admin@example.com`)

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions automatically.

Deploy with:

```bash
supabase functions deploy send-milestone-reminders --no-verify-jwt
```

The function still checks the service-role Authorization header, so it is intended to be invoked by the scheduled job.

## Schedule it

Enable `pg_cron`, `pg_net`, and `vault` in Supabase, store the function URL and service-role key in Vault, then create a cron job that POSTs to the function every minute. Example SQL:

```sql
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-milestone-reminders', 'milestone_reminder_function_url');
select vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'milestone_reminder_service_key');

select cron.schedule(
  'family-archive-milestone-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'milestone_reminder_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'milestone_reminder_service_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

The browser must first register a push subscription. Set `VITE_VAPID_PUBLIC_KEY` in the frontend environment to the same public VAPID key used by the function.
