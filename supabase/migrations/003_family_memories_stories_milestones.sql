-- Family Archive v3: connected gallery, stories and future milestones.

create table if not exists public.memory_people (
  memory_id uuid not null references public.memories(id) on delete cascade,
  person_id uuid not null references public.family_people(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (memory_id, person_id)
);

create table if not exists public.family_stories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  cover_path text,
  story_date date,
  location text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.story_people (
  story_id uuid not null references public.family_stories(id) on delete cascade,
  person_id uuid not null references public.family_people(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  primary key (story_id, person_id)
);

create table if not exists public.story_comments (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.family_stories(id) on delete cascade,
  body text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.family_milestones (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  target_date date,
  status text not null default 'idea' check (status in ('idea','in_progress','achieved')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.milestone_people (
  milestone_id uuid not null references public.family_milestones(id) on delete cascade,
  person_id uuid not null references public.family_people(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  primary key (milestone_id, person_id)
);

create table if not exists public.milestone_media (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.family_milestones(id) on delete cascade,
  media_path text not null,
  media_type text not null default 'image' check (media_type in ('image','video')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.milestone_comments (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.family_milestones(id) on delete cascade,
  body text not null,
  parent_id uuid references public.milestone_comments(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.milestone_contributions (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.family_milestones(id) on delete cascade,
  note text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists memory_people_person_idx on public.memory_people(person_id);
create index if not exists story_people_person_idx on public.story_people(person_id);
create index if not exists story_comments_story_idx on public.story_comments(story_id, created_at);
create index if not exists milestone_people_person_idx on public.milestone_people(person_id);
create index if not exists milestone_comments_idx on public.milestone_comments(milestone_id, created_at);
create index if not exists milestone_contributions_idx on public.milestone_contributions(milestone_id, created_at);

create or replace function public.touch_family_story_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create or replace function public.touch_family_milestone_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists family_story_updated_at on public.family_stories;
create trigger family_story_updated_at before update on public.family_stories for each row execute function public.touch_family_story_updated_at();
drop trigger if exists family_milestone_updated_at on public.family_milestones;
create trigger family_milestone_updated_at before update on public.family_milestones for each row execute function public.touch_family_milestone_updated_at();

alter table public.memory_people enable row level security;
alter table public.family_stories enable row level security;
alter table public.story_people enable row level security;
alter table public.story_comments enable row level security;
alter table public.family_milestones enable row level security;
alter table public.milestone_people enable row level security;
alter table public.milestone_media enable row level security;
alter table public.milestone_comments enable row level security;
alter table public.milestone_contributions enable row level security;

-- Family membership is the single access boundary for all new archive features.
create policy "approved family can view memory people" on public.memory_people for select to authenticated using (public.is_approved_family_member());
create policy "approved family can add memory people" on public.memory_people for insert to authenticated with check (public.is_approved_family_member() and created_by = auth.uid());
create policy "approved family can delete memory people" on public.memory_people for delete to authenticated using (public.is_approved_family_member());

create policy "approved family can view stories" on public.family_stories for select to authenticated using (public.is_approved_family_member());
create policy "approved family can add stories" on public.family_stories for insert to authenticated with check (public.is_approved_family_member() and created_by = auth.uid());
create policy "creators can update stories" on public.family_stories for update to authenticated using (public.is_approved_family_member() and created_by = auth.uid()) with check (public.is_approved_family_member() and created_by = auth.uid());
create policy "creators can delete stories" on public.family_stories for delete to authenticated using (public.is_approved_family_member() and created_by = auth.uid());

create policy "approved family can view story people" on public.story_people for select to authenticated using (public.is_approved_family_member());
create policy "approved family can add story people" on public.story_people for insert to authenticated with check (public.is_approved_family_member() and created_by = auth.uid());
create policy "approved family can delete story people" on public.story_people for delete to authenticated using (public.is_approved_family_member());
create policy "approved family can view story comments" on public.story_comments for select to authenticated using (public.is_approved_family_member());
create policy "approved family can add story comments" on public.story_comments for insert to authenticated with check (public.is_approved_family_member() and created_by = auth.uid());
create policy "comment creators can update story comments" on public.story_comments for update to authenticated using (public.is_approved_family_member() and created_by = auth.uid()) with check (public.is_approved_family_member() and created_by = auth.uid());
create policy "comment creators can delete story comments" on public.story_comments for delete to authenticated using (public.is_approved_family_member() and created_by = auth.uid());

create policy "approved family can view milestones" on public.family_milestones for select to authenticated using (public.is_approved_family_member());
create policy "approved family can add milestones" on public.family_milestones for insert to authenticated with check (public.is_approved_family_member() and created_by = auth.uid());
create policy "creators can update milestones" on public.family_milestones for update to authenticated using (public.is_approved_family_member() and created_by = auth.uid()) with check (public.is_approved_family_member() and created_by = auth.uid());
create policy "creators can delete milestones" on public.family_milestones for delete to authenticated using (public.is_approved_family_member() and created_by = auth.uid());

create policy "approved family can view milestone people" on public.milestone_people for select to authenticated using (public.is_approved_family_member());
create policy "approved family can add milestone people" on public.milestone_people for insert to authenticated with check (public.is_approved_family_member() and created_by = auth.uid());
create policy "approved family can delete milestone people" on public.milestone_people for delete to authenticated using (public.is_approved_family_member());
create policy "approved family can view milestone media" on public.milestone_media for select to authenticated using (public.is_approved_family_member());
create policy "approved family can add milestone media" on public.milestone_media for insert to authenticated with check (public.is_approved_family_member() and created_by = auth.uid());
create policy "approved family can delete milestone media" on public.milestone_media for delete to authenticated using (public.is_approved_family_member() and created_by = auth.uid());
create policy "approved family can view milestone comments" on public.milestone_comments for select to authenticated using (public.is_approved_family_member());
create policy "approved family can add milestone comments" on public.milestone_comments for insert to authenticated with check (public.is_approved_family_member() and created_by = auth.uid());
create policy "comment creators can update milestone comments" on public.milestone_comments for update to authenticated using (public.is_approved_family_member() and created_by = auth.uid()) with check (public.is_approved_family_member() and created_by = auth.uid());
create policy "comment creators can delete milestone comments" on public.milestone_comments for delete to authenticated using (public.is_approved_family_member() and created_by = auth.uid());
create policy "approved family can view milestone contributions" on public.milestone_contributions for select to authenticated using (public.is_approved_family_member());
create policy "approved family can add milestone contributions" on public.milestone_contributions for insert to authenticated with check (public.is_approved_family_member() and created_by = auth.uid());
create policy "contribution creators can delete milestone contributions" on public.milestone_contributions for delete to authenticated using (public.is_approved_family_member() and created_by = auth.uid());

comment on table public.memory_people is 'Connects gallery memories to people in the family tree.';
comment on table public.family_stories is 'Long-form family stories written by family members.';
comment on table public.family_milestones is 'Shared future plans, dreams and goals for the family.';
