-- Migration: 003_family_memories_stories_milestones.sql
-- Adds memories/stories/milestones and related join tables described in README

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- memories table (gallery items)
CREATE TABLE IF NOT EXISTS public.memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  description text,
  date date,
  category text,
  tags text[],
  author text,
  posted_by uuid,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  media_url text,
  media_type text,
  is_milestone boolean DEFAULT false,
  is_featured boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_memories_created_at ON public.memories(created_at);

-- memory_people (tagging people in photos)
CREATE TABLE IF NOT EXISTS public.memory_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL,
  person_id uuid NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_memory_people_memory_id ON public.memory_people(memory_id);

-- gallery albums
CREATE TABLE IF NOT EXISTS public.gallery_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  cover_path text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gallery_album_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL,
  memory_id uuid NOT NULL,
  added_by uuid,
  added_at timestamptz DEFAULT now()
);

-- stories
CREATE TABLE IF NOT EXISTS public.family_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  body text,
  story_date date,
  location text,
  cover_path text,
  audio_path text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.story_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL,
  person_id uuid NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.story_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL,
  body text,
  parent_id uuid,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- milestones
CREATE TABLE IF NOT EXISTS public.family_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  description text,
  target_date date,
  status text,
  budget_goal numeric,
  budget_currency text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.milestone_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL,
  person_id uuid NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.milestone_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL,
  media_path text,
  media_type text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.milestone_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL,
  body text,
  parent_id uuid,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.milestone_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL,
  note text,
  contribution_type text,
  amount numeric,
  currency text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.milestone_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL,
  title text,
  status text DEFAULT 'todo',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.milestone_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL,
  step_id uuid,
  contribution_id uuid,
  reminder_type text,
  title text,
  note text,
  remind_at timestamptz,
  remind_user_id uuid,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- push subscriptions and deliveries used by edge function
CREATE TABLE IF NOT EXISTS public.milestone_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.milestone_reminder_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id uuid NOT NULL,
  subscription_id uuid NOT NULL,
  delivered_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Note: RLS policies and FK constraints intentionally omitted; apply appropriate policies in Supabase dashboard.

-- Recommended cautious RLS policy templates (review and adapt before applying):

-- Enable RLS on tables that store user-generated content
-- ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.memory_people ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.gallery_albums ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.gallery_album_memories ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.family_stories ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.story_people ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.story_comments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.family_milestones ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.milestone_people ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.milestone_media ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.milestone_comments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.milestone_contributions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.milestone_steps ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.milestone_reminders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.milestone_push_subscriptions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.milestone_reminder_deliveries ENABLE ROW LEVEL SECURITY;

-- Ownership-based policies: allow authenticated users to operate on rows they created
-- (these assume a `created_by`, `created_by` or `user_id` column present)
-- Example for `memories`:
-- CREATE POLICY "memories_owner_crud" ON public.memories
--   FOR ALL
--   USING (created_by = auth.uid() OR posted_by = auth.uid())
--   WITH CHECK (created_by = auth.uid() OR posted_by = auth.uid());

-- Example: allow authenticated users to SELECT rows they created or that belong to their family
-- Replace the EXISTS subquery with your project's actual membership check.
-- CREATE POLICY "memories_select_family" ON public.memories
--   FOR SELECT
--   USING (
--     created_by = auth.uid()
--     OR posted_by = auth.uid()
--     OR EXISTS (
--       SELECT 1 FROM public.family_members fm WHERE fm.user_id = auth.uid()
--       -- AND fm.family_id = public.memories.family_id -- if your schema has family linkage
--     )
--   );

-- For join/association tables (memory_people, gallery_album_memories, story_people, etc.)
-- you can restrict INSERT/DELETE to users who own the parent resource. Example (memory_people):
-- CREATE POLICY "memory_people_parent_owner" ON public.memory_people
--   FOR INSERT, DELETE
--   USING (EXISTS (SELECT 1 FROM public.memories m WHERE m.id = memory_id AND m.created_by = auth.uid()))
--   WITH CHECK (EXISTS (SELECT 1 FROM public.memories m WHERE m.id = memory_id AND m.created_by = auth.uid()));

-- Push subscriptions: typically allow a user to manage only their own subscription
-- CREATE POLICY "milestone_push_subscriptions_owner" ON public.milestone_push_subscriptions
--   FOR ALL
--   USING (user_id = auth.uid())
--   WITH CHECK (user_id = auth.uid());

-- Delivery records: allow internal backend service role to insert deliveries (use service_role key),
-- and allow authenticated users to SELECT their deliveries if applicable.
-- Example placeholder:
-- CREATE POLICY "milestone_reminder_deliveries_insert_by_service" ON public.milestone_reminder_deliveries
--   FOR INSERT
--   USING (auth.role() = 'service_role')
--   WITH CHECK (auth.role() = 'service_role');

-- Notes:
-- 1) These are templates — adapt column names (e.g., `created_by`, `user_id`, `posted_by`) to your schema.
-- 2) Test policies in a staging Supabase project before applying to production.
-- 3) You may need additional policies to allow your backend edge functions (service role) to perform writes — typically done by using the service role key from a secure environment and not via RLS exceptions.

-- -------------------------------
-- Concrete `memories` RLS templates
-- -------------------------------
-- These statements are deliberately commented out. Review, adapt column names, then run them
-- in the Supabase SQL editor (or include uncommented in a migration) when ready.

-- 1) Enable RLS on `memories` (required before adding policies)
-- ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

-- 2) Owner-based full CRUD policy: allow the creator (or `posted_by`) to fully manage their rows
-- CREATE POLICY "memories_owner_crud" ON public.memories
--   FOR ALL
--   USING (created_by = auth.uid() OR posted_by = auth.uid())
--   WITH CHECK (created_by = auth.uid() OR posted_by = auth.uid());

-- 3) Read policy for family members (example placeholder):
--    This assumes you have a `family_members(user_id, family_id)` table and a `family_id` column
--    on `memories`. Update the subquery to match your membership model.
-- CREATE POLICY "memories_select_family" ON public.memories
--   FOR SELECT
--   USING (
--     created_by = auth.uid()
--     OR posted_by = auth.uid()
--     OR (
--       -- example membership check; adapt to your schema
--       EXISTS (
--         SELECT 1
--         FROM public.family_members fm
--         WHERE fm.user_id = auth.uid()
--           AND fm.family_id = public.memories.family_id
--       )
--     )
--   );

-- 4) Insert/Update guard: ensure `created_by` is set to the authenticated user
--    This prevents users from inserting rows that claim another user as owner.
-- CREATE POLICY "memories_insert_auth_check" ON public.memories
--   FOR INSERT, UPDATE
--   WITH CHECK (created_by = auth.uid() OR posted_by = auth.uid());

-- 5) Service role exceptions (for server-side jobs):
--    Use your service_role key in trusted server code to bypass RLS when necessary.
--    Do NOT store the service role key in client-side code.

-- Quick test sequence (run in Supabase SQL editor after applying policies):
-- 1) Try anonymous INSERT (should be denied if no anon policy exists).
-- 2) Sign up/sign in a user and attempt INSERT where `created_by = auth.uid()` (should succeed).
-- 3) Try SELECT as another user (should be denied unless membership applies).


