-- Family Archive v2: people, relationships and private profile photos.
-- Run this in Supabase SQL Editor after the existing family_members table exists.

create extension if not exists pgcrypto;

create or replace function public.is_approved_family_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.user_id = auth.uid()
      and fm.status = 'approved'
  );
$$;

grant execute on function public.is_approved_family_member() to authenticated;

create table if not exists public.family_people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  preferred_name text,
  birth_date date,
  death_date date,
  location text,
  relationship_label text,
  bio text,
  photo_path text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_relationships (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.family_people(id) on delete cascade,
  related_person_id uuid not null references public.family_people(id) on delete cascade,
  relationship_type text not null check (
    relationship_type in ('parent', 'child', 'spouse', 'sibling')
  ),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (person_id, related_person_id, relationship_type),
  check (person_id <> related_person_id)
);

create index if not exists family_people_created_at_idx
  on public.family_people(created_at desc);

create index if not exists family_relationships_person_idx
  on public.family_relationships(person_id);

create index if not exists family_relationships_related_idx
  on public.family_relationships(related_person_id);

create or replace function public.touch_family_people_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists family_people_updated_at on public.family_people;
create trigger family_people_updated_at
before update on public.family_people
for each row execute function public.touch_family_people_updated_at();

alter table public.family_people enable row level security;
alter table public.family_relationships enable row level security;

drop policy if exists "approved family can view people" on public.family_people;
create policy "approved family can view people"
on public.family_people
for select to authenticated
using (public.is_approved_family_member());

drop policy if exists "approved family can add people" on public.family_people;
create policy "approved family can add people"
on public.family_people
for insert to authenticated
with check (
  public.is_approved_family_member()
  and created_by = auth.uid()
);

drop policy if exists "creators can update people" on public.family_people;
create policy "creators can update people"
on public.family_people
for update to authenticated
using (public.is_approved_family_member())
with check (public.is_approved_family_member());

drop policy if exists "approved family can view relationships" on public.family_relationships;
create policy "approved family can view relationships"
on public.family_relationships
for select to authenticated
using (public.is_approved_family_member());

drop policy if exists "approved family can add relationships" on public.family_relationships;
create policy "approved family can add relationships"
on public.family_relationships
for insert to authenticated
with check (
  public.is_approved_family_member()
  and created_by = auth.uid()
);

drop policy if exists "approved family can update relationships" on public.family_relationships;
create policy "approved family can update relationships"
on public.family_relationships
for update to authenticated
using (public.is_approved_family_member())
with check (public.is_approved_family_member());

drop policy if exists "approved family can delete relationships" on public.family_relationships;
create policy "approved family can delete relationships"
on public.family_relationships
for delete to authenticated
using (public.is_approved_family_member());

-- Reuse the private family-media bucket for profile photos.
insert into storage.buckets (id, name, public)
values ('family-media', 'family-media', false)
on conflict (id) do update set public = false;

drop policy if exists "approved family can read family media" on storage.objects;
create policy "approved family can read family media"
on storage.objects
for select to authenticated
using (
  bucket_id = 'family-media'
  and public.is_approved_family_member()
);

drop policy if exists "approved family can upload family media" on storage.objects;
create policy "approved family can upload family media"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'family-media'
  and public.is_approved_family_member()
);

drop policy if exists "approved family can update family media" on storage.objects;
create policy "approved family can update family media"
on storage.objects
for update to authenticated
using (
  bucket_id = 'family-media'
  and public.is_approved_family_member()
)
with check (
  bucket_id = 'family-media'
  and public.is_approved_family_member()
);

comment on table public.family_people is 'Human profiles displayed in the interactive family tree.';
comment on table public.family_relationships is 'Explicit relationships used to render the family tree.';
