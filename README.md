# Family Archive

A private web app where a family can keep its memories in one place: photos, stories, a family tree and shared goals. Only people an admin has approved can get in, and every photo is stored privately.

<!-- Add screenshots here, for example:
![Home page](docs/screenshots/home.png)
![Family tree](docs/screenshots/family-tree.png)
-->

## Features

- **Memories and gallery.** Add photos with a date, place and the people in them, then group them into family albums. Photos open in a full-screen lightbox.
- **Family tree.** Show the family across generations, with parents, spouses, birth and death dates.
- **Stories.** Write longer family stories, tag the people in them and comment on each other's stories.
- **Milestones.** Plan shared family goals with steps, contributions, photos and comments, plus reminders sent as browser push notifications.
- **Family activity feed** and an in-app notification centre, updated live.
- **Invite-only access.** New sign-ups wait as "pending" until an admin approves them. Admins can also make other members admins.
- **Profiles** for each family member.

## How it's built

| Part | Technology |
| --- | --- |
| Frontend | React 19 and Vite |
| Database and login | Supabase (Postgres and Supabase Auth) |
| Access rules | Postgres row level security, so only approved members can read family data |
| Photos | A private Supabase storage bucket; images are shown through short-lived signed URLs |
| Reminders | A Supabase Edge Function sends web push notifications through a service worker |

```
src/
├── components/   # one folder per screen (Gallery, FamilyTree, Stories, Milestones, …)
├── lib/          # storage, notifications and toast helpers
└── styles/       # shared design tokens and layout
supabase/
├── migrations/   # database tables and security policies, run in order
└── functions/    # send-milestone-reminders Edge Function
```

## Run it locally

You need Node.js 20+ and a free [Supabase](https://supabase.com) project.

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up the database.** In the Supabase SQL editor, run each file in `supabase/migrations/` in order, starting with `001_family_members.sql`. Then create a private storage bucket called `family-media`.

3. **Add your keys.** Copy `.env.example` to `.env.local` and fill in your project URL and anon key from Supabase. The VAPID key is only needed for push reminders.

   ```text
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   VITE_VAPID_PUBLIC_KEY=
   ```

   Only browser-safe values go here. Service-role keys, VAPID private keys and the reminder secret stay in Supabase Edge Function secrets.

4. **Start the app**

   ```bash
   npm run dev
   ```

5. **Make yourself the first admin.** Sign up in the app, then run this once in the SQL editor with your own email:

   ```sql
   UPDATE public.family_members
   SET status = 'approved', role = 'admin'
   WHERE email = 'you@example.com';
   ```

## Checks

```bash
npm run lint
npm run build
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for hosting the frontend and deploying the reminder function.
