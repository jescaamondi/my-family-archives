-- Family Archive v14: optional custom cover image for family-created albums.
alter table public.gallery_albums add column if not exists cover_path text;
comment on column public.gallery_albums.cover_path is 'Optional path in family-media storage used as the album cover.';
