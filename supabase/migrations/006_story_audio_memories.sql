-- Add optional voice/audio memories to family stories.
alter table public.family_stories
  add column if not exists audio_path text;

comment on column public.family_stories.audio_path is
  'Private family-media storage path for an optional audio memory attached to the story.';
