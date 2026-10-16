# Deployment checklist

## Frontend host

Use either the source project with a Node build or the included `dist/` directory for static hosting.

Build command:

```bash
npm run build
```

Publish directory:

```text
dist
```

For a source-based host, set these environment variables before the build:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_VAPID_PUBLIC_KEY
```

The Vite frontend intentionally has no fallback Supabase credentials.

## Supabase

Apply the migrations in `supabase/migrations/` to the intended project.

Verify the existing `family_members` table and its approval/admin RLS policies before production use.

Verify the private `family-media` bucket has policies for approved family users and the required upload/read paths.

## Push reminders

Deploy:

```text
supabase/functions/send-milestone-reminders/
```

Keep these values only in Supabase Edge Function secrets:

- VAPID_PUBLIC_KEY
- VAPID_PRIVATE_KEY
- VAPID_SUBJECT
- the scheduler/cron authentication secret used by the deployed function

Never put the private VAPID key or service-role key into the React app.

## Final local verification

```bash
npm install
npm run lint
npm run build
```
