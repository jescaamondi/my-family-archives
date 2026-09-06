# Family Archive v25 — Final UI polish before Supabase cleanup

This version completes the requested pre-Supabase polish:

- Home dashboard: upcoming reminders, on-this-day memory, active family dreams.
- Gallery favorites: star memories and browse a Favorites view (stored locally for now; production persistence can be moved to Supabase during cleanup).
- Family Tree person profiles: life timeline built from birth/death dates plus connected memories and stories.
- Notifications center: family activity, reminders, milestone comments and contributions, with read state and links back to Milestones.

Next phase: consolidate all Supabase migrations, normalize schema, review RLS/storage policies, indexes, foreign keys, scheduled reminder infrastructure, and production environment variables.
