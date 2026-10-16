-- Baseline RLS for the private family archive.
-- Assumes family_members already exists with user_id, status and role columns.
-- This migration does not change family_members policies because access/approval
-- policies are family-specific and may already exist in the target project.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_approved_family_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.user_id = auth.uid()
      AND fm.status = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION public.is_approved_family_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_approved_family_member() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_family_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.user_id = auth.uid()
      AND fm.status = 'approved'
      AND fm.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_family_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_family_admin() TO authenticated;

-- Genealogy
ALTER TABLE IF EXISTS public.family_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.family_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS family_people_family_select ON public.family_people;
DROP POLICY IF EXISTS family_people_owner_insert ON public.family_people;
DROP POLICY IF EXISTS family_people_owner_update ON public.family_people;
DROP POLICY IF EXISTS family_people_owner_delete ON public.family_people;

CREATE POLICY family_people_family_select ON public.family_people
  FOR SELECT TO authenticated
  USING (public.is_approved_family_member());

CREATE POLICY family_people_owner_insert ON public.family_people
  FOR INSERT TO authenticated
  WITH CHECK (public.is_approved_family_member() AND created_by = auth.uid());

CREATE POLICY family_people_owner_update ON public.family_people
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_family_admin())
  WITH CHECK (created_by = auth.uid() OR public.is_family_admin());

CREATE POLICY family_people_owner_delete ON public.family_people
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_family_admin());

DROP POLICY IF EXISTS family_relationships_family_select ON public.family_relationships;
DROP POLICY IF EXISTS family_relationships_owner_insert ON public.family_relationships;
DROP POLICY IF EXISTS family_relationships_owner_delete ON public.family_relationships;

CREATE POLICY family_relationships_family_select ON public.family_relationships
  FOR SELECT TO authenticated
  USING (public.is_approved_family_member());

CREATE POLICY family_relationships_owner_insert ON public.family_relationships
  FOR INSERT TO authenticated
  WITH CHECK (public.is_approved_family_member() AND created_by = auth.uid());

CREATE POLICY family_relationships_owner_delete ON public.family_relationships
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_family_admin());

-- Memories and gallery
ALTER TABLE IF EXISTS public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.memory_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gallery_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gallery_album_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS family_memories_select ON public.memories;
DROP POLICY IF EXISTS family_memories_insert ON public.memories;
DROP POLICY IF EXISTS family_memories_update ON public.memories;
DROP POLICY IF EXISTS family_memories_delete ON public.memories;

CREATE POLICY family_memories_select ON public.memories
  FOR SELECT TO authenticated
  USING (public.is_approved_family_member());

CREATE POLICY family_memories_insert ON public.memories
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_approved_family_member()
    AND (created_by = auth.uid() OR posted_by = auth.uid())
  );

CREATE POLICY family_memories_update ON public.memories
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR posted_by = auth.uid() OR public.is_family_admin())
  WITH CHECK (created_by = auth.uid() OR posted_by = auth.uid() OR public.is_family_admin());

CREATE POLICY family_memories_delete ON public.memories
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR posted_by = auth.uid() OR public.is_family_admin());

DROP POLICY IF EXISTS memory_people_family_select ON public.memory_people;
DROP POLICY IF EXISTS memory_people_owner_insert ON public.memory_people;
DROP POLICY IF EXISTS memory_people_owner_delete ON public.memory_people;

CREATE POLICY memory_people_family_select ON public.memory_people
  FOR SELECT TO authenticated
  USING (public.is_approved_family_member());

CREATE POLICY memory_people_owner_insert ON public.memory_people
  FOR INSERT TO authenticated
  WITH CHECK (public.is_approved_family_member() AND created_by = auth.uid());

CREATE POLICY memory_people_owner_delete ON public.memory_people
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_family_admin());

DROP POLICY IF EXISTS gallery_albums_family_select ON public.gallery_albums;
DROP POLICY IF EXISTS gallery_albums_owner_insert ON public.gallery_albums;
DROP POLICY IF EXISTS gallery_albums_owner_update ON public.gallery_albums;
DROP POLICY IF EXISTS gallery_albums_owner_delete ON public.gallery_albums;

CREATE POLICY gallery_albums_family_select ON public.gallery_albums
  FOR SELECT TO authenticated
  USING (public.is_approved_family_member());

CREATE POLICY gallery_albums_owner_insert ON public.gallery_albums
  FOR INSERT TO authenticated
  WITH CHECK (public.is_approved_family_member() AND created_by = auth.uid());

CREATE POLICY gallery_albums_owner_update ON public.gallery_albums
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_family_admin())
  WITH CHECK (created_by = auth.uid() OR public.is_family_admin());

CREATE POLICY gallery_albums_owner_delete ON public.gallery_albums
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_family_admin());

DROP POLICY IF EXISTS gallery_album_memories_family_select ON public.gallery_album_memories;
DROP POLICY IF EXISTS gallery_album_memories_owner_insert ON public.gallery_album_memories;
DROP POLICY IF EXISTS gallery_album_memories_owner_delete ON public.gallery_album_memories;

CREATE POLICY gallery_album_memories_family_select ON public.gallery_album_memories
  FOR SELECT TO authenticated
  USING (public.is_approved_family_member());

CREATE POLICY gallery_album_memories_owner_insert ON public.gallery_album_memories
  FOR INSERT TO authenticated
  WITH CHECK (public.is_approved_family_member() AND added_by = auth.uid());

CREATE POLICY gallery_album_memories_owner_delete ON public.gallery_album_memories
  FOR DELETE TO authenticated
  USING (added_by = auth.uid() OR public.is_family_admin());

-- Stories
ALTER TABLE IF EXISTS public.family_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.story_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.story_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS family_stories_family_select ON public.family_stories;
DROP POLICY IF EXISTS family_stories_owner_insert ON public.family_stories;
DROP POLICY IF EXISTS family_stories_owner_update ON public.family_stories;
DROP POLICY IF EXISTS family_stories_owner_delete ON public.family_stories;

CREATE POLICY family_stories_family_select ON public.family_stories
  FOR SELECT TO authenticated USING (public.is_approved_family_member());
CREATE POLICY family_stories_owner_insert ON public.family_stories
  FOR INSERT TO authenticated WITH CHECK (public.is_approved_family_member() AND created_by = auth.uid());
CREATE POLICY family_stories_owner_update ON public.family_stories
  FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_family_admin()) WITH CHECK (created_by = auth.uid() OR public.is_family_admin());
CREATE POLICY family_stories_owner_delete ON public.family_stories
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_family_admin());

DROP POLICY IF EXISTS story_people_family_select ON public.story_people;
DROP POLICY IF EXISTS story_people_owner_insert ON public.story_people;
DROP POLICY IF EXISTS story_people_owner_delete ON public.story_people;
CREATE POLICY story_people_family_select ON public.story_people
  FOR SELECT TO authenticated USING (public.is_approved_family_member());
CREATE POLICY story_people_owner_insert ON public.story_people
  FOR INSERT TO authenticated WITH CHECK (public.is_approved_family_member() AND created_by = auth.uid());
CREATE POLICY story_people_owner_delete ON public.story_people
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_family_admin());

DROP POLICY IF EXISTS story_comments_family_select ON public.story_comments;
DROP POLICY IF EXISTS story_comments_owner_insert ON public.story_comments;
DROP POLICY IF EXISTS story_comments_owner_update ON public.story_comments;
DROP POLICY IF EXISTS story_comments_owner_delete ON public.story_comments;
CREATE POLICY story_comments_family_select ON public.story_comments
  FOR SELECT TO authenticated USING (public.is_approved_family_member());
CREATE POLICY story_comments_owner_insert ON public.story_comments
  FOR INSERT TO authenticated WITH CHECK (public.is_approved_family_member() AND created_by = auth.uid());
CREATE POLICY story_comments_owner_update ON public.story_comments
  FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_family_admin()) WITH CHECK (created_by = auth.uid() OR public.is_family_admin());
CREATE POLICY story_comments_owner_delete ON public.story_comments
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_family_admin());

-- Milestones and their child records
ALTER TABLE IF EXISTS public.family_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.milestone_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.milestone_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.milestone_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.milestone_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.milestone_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.milestone_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.milestone_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.milestone_reminder_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS family_milestones_family_select ON public.family_milestones;
DROP POLICY IF EXISTS family_milestones_owner_insert ON public.family_milestones;
DROP POLICY IF EXISTS family_milestones_owner_update ON public.family_milestones;
DROP POLICY IF EXISTS family_milestones_owner_delete ON public.family_milestones;
CREATE POLICY family_milestones_family_select ON public.family_milestones
  FOR SELECT TO authenticated USING (public.is_approved_family_member());
CREATE POLICY family_milestones_owner_insert ON public.family_milestones
  FOR INSERT TO authenticated WITH CHECK (public.is_approved_family_member() AND created_by = auth.uid());
CREATE POLICY family_milestones_owner_update ON public.family_milestones
  FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_family_admin()) WITH CHECK (created_by = auth.uid() OR public.is_family_admin());
CREATE POLICY family_milestones_owner_delete ON public.family_milestones
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_family_admin());

-- Reusable child-table policy pattern.
DROP POLICY IF EXISTS milestone_people_family_select ON public.milestone_people;
DROP POLICY IF EXISTS milestone_people_owner_insert ON public.milestone_people;
DROP POLICY IF EXISTS milestone_people_owner_delete ON public.milestone_people;
CREATE POLICY milestone_people_family_select ON public.milestone_people FOR SELECT TO authenticated USING (public.is_approved_family_member());
CREATE POLICY milestone_people_owner_insert ON public.milestone_people FOR INSERT TO authenticated WITH CHECK (public.is_approved_family_member() AND created_by = auth.uid());
CREATE POLICY milestone_people_owner_delete ON public.milestone_people FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_family_admin());

DROP POLICY IF EXISTS milestone_media_family_select ON public.milestone_media;
DROP POLICY IF EXISTS milestone_media_owner_insert ON public.milestone_media;
DROP POLICY IF EXISTS milestone_media_owner_delete ON public.milestone_media;
CREATE POLICY milestone_media_family_select ON public.milestone_media FOR SELECT TO authenticated USING (public.is_approved_family_member());
CREATE POLICY milestone_media_owner_insert ON public.milestone_media FOR INSERT TO authenticated WITH CHECK (public.is_approved_family_member() AND created_by = auth.uid());
CREATE POLICY milestone_media_owner_delete ON public.milestone_media FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_family_admin());

DROP POLICY IF EXISTS milestone_comments_family_select ON public.milestone_comments;
DROP POLICY IF EXISTS milestone_comments_owner_insert ON public.milestone_comments;
DROP POLICY IF EXISTS milestone_comments_owner_update ON public.milestone_comments;
DROP POLICY IF EXISTS milestone_comments_owner_delete ON public.milestone_comments;
CREATE POLICY milestone_comments_family_select ON public.milestone_comments FOR SELECT TO authenticated USING (public.is_approved_family_member());
CREATE POLICY milestone_comments_owner_insert ON public.milestone_comments FOR INSERT TO authenticated WITH CHECK (public.is_approved_family_member() AND created_by = auth.uid());
CREATE POLICY milestone_comments_owner_update ON public.milestone_comments FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_family_admin()) WITH CHECK (created_by = auth.uid() OR public.is_family_admin());
CREATE POLICY milestone_comments_owner_delete ON public.milestone_comments FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_family_admin());

DROP POLICY IF EXISTS milestone_contributions_family_select ON public.milestone_contributions;
DROP POLICY IF EXISTS milestone_contributions_owner_insert ON public.milestone_contributions;
DROP POLICY IF EXISTS milestone_contributions_owner_delete ON public.milestone_contributions;
CREATE POLICY milestone_contributions_family_select ON public.milestone_contributions FOR SELECT TO authenticated USING (public.is_approved_family_member());
CREATE POLICY milestone_contributions_owner_insert ON public.milestone_contributions FOR INSERT TO authenticated WITH CHECK (public.is_approved_family_member() AND created_by = auth.uid());
CREATE POLICY milestone_contributions_owner_delete ON public.milestone_contributions FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_family_admin());

DROP POLICY IF EXISTS milestone_steps_family_select ON public.milestone_steps;
DROP POLICY IF EXISTS milestone_steps_owner_insert ON public.milestone_steps;
DROP POLICY IF EXISTS milestone_steps_owner_update ON public.milestone_steps;
DROP POLICY IF EXISTS milestone_steps_owner_delete ON public.milestone_steps;
CREATE POLICY milestone_steps_family_select ON public.milestone_steps FOR SELECT TO authenticated USING (public.is_approved_family_member());
CREATE POLICY milestone_steps_owner_insert ON public.milestone_steps FOR INSERT TO authenticated WITH CHECK (public.is_approved_family_member() AND created_by = auth.uid());
CREATE POLICY milestone_steps_owner_update ON public.milestone_steps FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_family_admin()) WITH CHECK (created_by = auth.uid() OR public.is_family_admin());
CREATE POLICY milestone_steps_owner_delete ON public.milestone_steps FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_family_admin());

DROP POLICY IF EXISTS milestone_reminders_family_select ON public.milestone_reminders;
DROP POLICY IF EXISTS milestone_reminders_owner_insert ON public.milestone_reminders;
DROP POLICY IF EXISTS milestone_reminders_owner_update ON public.milestone_reminders;
DROP POLICY IF EXISTS milestone_reminders_owner_delete ON public.milestone_reminders;
CREATE POLICY milestone_reminders_family_select ON public.milestone_reminders FOR SELECT TO authenticated USING (public.is_approved_family_member());
CREATE POLICY milestone_reminders_owner_insert ON public.milestone_reminders FOR INSERT TO authenticated WITH CHECK (public.is_approved_family_member() AND created_by = auth.uid());
CREATE POLICY milestone_reminders_owner_update ON public.milestone_reminders FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_family_admin()) WITH CHECK (created_by = auth.uid() OR public.is_family_admin());
CREATE POLICY milestone_reminders_owner_delete ON public.milestone_reminders FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_family_admin());

DROP POLICY IF EXISTS milestone_push_subscriptions_owner_all ON public.milestone_push_subscriptions;
CREATE POLICY milestone_push_subscriptions_owner_all ON public.milestone_push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Delivery records are written by the server-side Edge Function using the service role.

COMMIT;
