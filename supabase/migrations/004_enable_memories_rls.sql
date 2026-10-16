-- Migration: 004_enable_memories_rls.sql
-- Enables Row Level Security for `memories` and adds an owner-based policy.
-- Review before running in production. This migration is idempotent.

BEGIN;

-- Enable RLS
ALTER TABLE IF EXISTS public.memories ENABLE ROW LEVEL SECURITY;

-- Owner-based policy: allow creators (or `posted_by`) to manage their rows
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'memories') THEN
    -- remove existing policy if present
    PERFORM pg_sleep(0); -- no-op to keep DO block structure clear
  END IF;
END$$;

-- Drop existing policy to ensure idempotency
DROP POLICY IF EXISTS memories_owner_crud ON public.memories;

CREATE POLICY memories_owner_crud ON public.memories
  FOR ALL
  USING (created_by = auth.uid() OR posted_by = auth.uid())
  WITH CHECK (created_by = auth.uid() OR posted_by = auth.uid());

COMMIT;

-- Notes:
-- - This migration enforces that only the owner (created_by or posted_by) can INSERT/UPDATE/DELETE/SELECT their rows.
-- - If you need broader SELECT access for family members, add a separate SELECT policy that uses your
--   application's membership table (e.g. public.family_members) and a family linkage column on `memories`.
-- - For server-side jobs, use the Supabase service_role key (secure, not in client code) to bypass RLS when necessary.
