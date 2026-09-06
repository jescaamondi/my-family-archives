-- Family Archive v13: optional family-created albums alongside automatic collections.
create table if not exists public.gallery_albums (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery_album_memories (
  album_id uuid not null references public.gallery_albums(id) on delete cascade,
  memory_id uuid not null references public.memories(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (album_id, memory_id)
);

create index if not exists gallery_album_memories_memory_idx on public.gallery_album_memories(memory_id);
create index if not exists gallery_albums_created_at_idx on public.gallery_albums(created_at desc);

create or replace function public.touch_gallery_album_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists gallery_album_updated_at on public.gallery_albums;
create trigger gallery_album_updated_at before update on public.gallery_albums for each row execute function public.touch_gallery_album_updated_at();

alter table public.gallery_albums enable row level security;
alter table public.gallery_album_memories enable row level security;

create policy "approved family can view gallery albums" on public.gallery_albums for select to authenticated using (public.is_approved_family_member());
create policy "approved family can create gallery albums" on public.gallery_albums for insert to authenticated with check (public.is_approved_family_member() and created_by = auth.uid());
create policy "album creators can update gallery albums" on public.gallery_albums for update to authenticated using (public.is_approved_family_member() and created_by = auth.uid()) with check (public.is_approved_family_member() and created_by = auth.uid());
create policy "album creators can delete gallery albums" on public.gallery_albums for delete to authenticated using (public.is_approved_family_member() and created_by = auth.uid());
create policy "approved family can view album memories" on public.gallery_album_memories for select to authenticated using (public.is_approved_family_member());
create policy "approved family can add album memories" on public.gallery_album_memories for insert to authenticated with check (public.is_approved_family_member() and added_by = auth.uid());
create policy "approved family can remove album memories" on public.gallery_album_memories for delete to authenticated using (public.is_approved_family_member());

comment on table public.gallery_albums is 'Optional family-created gallery albums. Automatic year collections remain separate.';
