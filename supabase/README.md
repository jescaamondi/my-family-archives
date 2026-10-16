# Supabase deployment notes

Run the migrations in `supabase/migrations/` against the intended Supabase project in order.

Before production use, verify the live project has:

- `family_members` for authenticated family access and admin approval
- `family-media` private storage bucket
- storage policies that allow approved family members to use the required private media paths
- RLS policies for application tables
- the `send-milestone-reminders` Edge Function and its server-side secrets if push reminders are enabled

Do not put service-role keys, Supabase secret keys, VAPID private keys or cron secrets into the React frontend.
