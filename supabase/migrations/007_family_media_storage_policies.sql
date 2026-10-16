-- Private family-media bucket policies.
-- The bucket itself should already exist and be private.

BEGIN;

DROP POLICY IF EXISTS family_media_family_select ON storage.objects;
DROP POLICY IF EXISTS family_media_family_insert ON storage.objects;
DROP POLICY IF EXISTS family_media_owner_update ON storage.objects;
DROP POLICY IF EXISTS family_media_owner_delete ON storage.objects;

CREATE POLICY family_media_family_select
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'family-media'
  AND public.is_approved_family_member()
);

CREATE POLICY family_media_family_insert
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'family-media'
  AND public.is_approved_family_member()
);

CREATE POLICY family_media_owner_update
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'family-media'
  AND (
    public.is_family_admin()
    OR split_part(name, '/', 2) = auth.uid()::text
    OR split_part(name, '/', 1) = auth.uid()::text
  )
)
WITH CHECK (
  bucket_id = 'family-media'
  AND (
    public.is_family_admin()
    OR split_part(name, '/', 2) = auth.uid()::text
    OR split_part(name, '/', 1) = auth.uid()::text
  )
);

CREATE POLICY family_media_owner_delete
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'family-media'
  AND (
    public.is_family_admin()
    OR split_part(name, '/', 2) = auth.uid()::text
    OR split_part(name, '/', 1) = auth.uid()::text
  )
);

COMMIT;
