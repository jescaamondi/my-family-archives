-- Migration: 005_family_members_photo_path.sql
-- Adds `photo_path` and `avatar_path` to `family_members` so we can store private storage paths.

BEGIN;

ALTER TABLE IF EXISTS public.family_members
  ADD COLUMN IF NOT EXISTS photo_path text;

ALTER TABLE IF EXISTS public.family_members
  ADD COLUMN IF NOT EXISTS avatar_path text;

COMMIT;

-- After running this migration, update any code that displays member avatars to
-- generate signed URLs from the `photo_path`/`avatar_path` when present.
