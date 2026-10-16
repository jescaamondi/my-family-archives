# Family Archive

Private family archive built with React, Vite and Supabase.

## Requirements

- Node.js 20+
- A Supabase project with the required tables, storage bucket and RLS policies
- A VAPID public key if browser push notifications are enabled

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and provide the frontend values:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_VAPID_PUBLIC_KEY=
```

Never put service-role keys, Supabase secret keys, VAPID private keys or cron secrets in `.env.local` for the frontend.

3. Run the app:

```bash
npm run dev
```

4. Verify the production build:

```bash
npm run lint
npm run build
```

## Supabase

SQL migrations are in `supabase/migrations/`.

The private `family-media` storage bucket is used for family photos, profile photos, stories and milestone media. Private objects should be stored as paths and displayed through signed URLs.

The scheduled reminder Edge Function is in:

`supabase/functions/send-milestone-reminders/`

Its private VAPID credentials and scheduler secret must remain in Supabase Edge Function secrets.

## Deployment

Build the frontend with:

```bash
npm run build
```

Deploy the generated `dist/` directory to your chosen static host, or configure the host to run `npm run build` and publish `dist`.

Configure the three `VITE_*` environment variables in the hosting provider before building.
