-- Migration: 001_family_members.sql
-- Creates the membership table that controls who can use the archive.
-- Every new sign-up gets a 'pending' row; an admin approves them in the app.
--
-- In the original project this table was created in the Supabase dashboard.
-- This file lets a fresh project be set up from the repo alone.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.family_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  email         text,
  full_name     text,
  relationship  text,
  bio           text,
  birth_date    date,
  death_date    date,
  generation    integer DEFAULT 1,
  parent_id     uuid REFERENCES public.family_members (id) ON DELETE SET NULL,
  spouse_id     uuid REFERENCES public.family_members (id) ON DELETE SET NULL,
  location      text,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  role          text NOT NULL DEFAULT 'member'
                CHECK (role IN ('member', 'admin')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Create a pending membership row whenever someone signs up.
CREATE OR REPLACE FUNCTION public.handle_new_family_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.family_members (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_family_member ON auth.users;
CREATE TRIGGER on_auth_user_created_family_member
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_family_member();

-- Row level security
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- Helper that checks admin rights without re-triggering these policies.
CREATE OR REPLACE FUNCTION public.is_family_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members fm
    WHERE fm.user_id = auth.uid()
      AND fm.status = 'approved'
      AND fm.role = 'admin'
  );
$$;

-- Everyone can see their own row (the app uses this to check approval).
DROP POLICY IF EXISTS "Members can read own row" ON public.family_members;
CREATE POLICY "Members can read own row"
  ON public.family_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Approved members can see the other approved members.
DROP POLICY IF EXISTS "Approved members can read approved members" ON public.family_members;
CREATE POLICY "Approved members can read approved members"
  ON public.family_members FOR SELECT TO authenticated
  USING (
    status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.family_members me
      WHERE me.user_id = auth.uid() AND me.status = 'approved'
    )
  );

-- Admins can see and manage everyone, including pending requests.
DROP POLICY IF EXISTS "Admins can read all members" ON public.family_members;
CREATE POLICY "Admins can read all members"
  ON public.family_members FOR SELECT TO authenticated
  USING (public.is_family_admin());

DROP POLICY IF EXISTS "Admins can update members" ON public.family_members;
CREATE POLICY "Admins can update members"
  ON public.family_members FOR UPDATE TO authenticated
  USING (public.is_family_admin())
  WITH CHECK (public.is_family_admin());

COMMIT;

-- First admin: after you sign up, run this once in the SQL editor
-- (replace the email with your own):
--
--   UPDATE public.family_members
--   SET status = 'approved', role = 'admin'
--   WHERE email = 'you@example.com';
