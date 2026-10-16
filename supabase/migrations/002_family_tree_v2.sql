-- Migration: 002_family_tree_v2.sql
-- Adds family_people and family_relationships per README

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.family_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text,
  preferred_name text,
  relationship text,
  bio text,
  birth_date date,
  death_date date,
  generation integer,
  parent_id uuid,
  spouse_id uuid,
  photo_path text,
  photo_url text,
  avatar_url text,
  location text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_family_people_parent_id ON public.family_people(parent_id);
CREATE INDEX IF NOT EXISTS idx_family_people_spouse_id ON public.family_people(spouse_id);

CREATE TABLE IF NOT EXISTS public.family_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  related_person_id uuid NOT NULL,
  relationship_type text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_relationships_person_id ON public.family_relationships(person_id);
CREATE INDEX IF NOT EXISTS idx_family_relationships_related_person_id ON public.family_relationships(related_person_id);

-- Note: RLS policies are intentionally omitted by this migration. Apply RLS policies in the Supabase dashboard as appropriate.
-- Recommended cautious RLS policy templates (review and adapt before applying):

-- Enable RLS on family_people and family_relationships
-- ALTER TABLE public.family_people ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.family_relationships ENABLE ROW LEVEL SECURITY;

-- Example policy: allow row owners (creator) to SELECT/INSERT/UPDATE/DELETE their records
-- Replace `created_by` with the appropriate ownership column if different.
-- CREATE POLICY "family_people_owner_crud" ON public.family_people
--   FOR ALL
--   USING (created_by = auth.uid())
--   WITH CHECK (created_by = auth.uid());

-- CREATE POLICY "family_relationships_owner_crud" ON public.family_relationships
--   FOR ALL
--   USING (created_by = auth.uid())
--   WITH CHECK (created_by = auth.uid());

-- Example more permissive read policy for family members of the same family (placeholder):
-- This template assumes you have a `family_members` or equivalent table linking users to families.
-- Replace the EXISTS subquery with your project's membership check.
-- CREATE POLICY "family_people_select_family" ON public.family_people
--   FOR SELECT
--   USING (
--     created_by = auth.uid()
--     OR EXISTS (
--       SELECT 1 FROM public.family_members fm
--       WHERE fm.user_id = auth.uid()
--       -- and fm.family_id = public.family_people.family_id  -- if applicable
--     )
--   );

-- Notes:
-- 1) Do NOT enable broad public access. Review each POLICY before running it in your DB.
-- 2) Apply these commands in Supabase SQL editor or include in a migration pipeline after review.
