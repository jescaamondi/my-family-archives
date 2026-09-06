-- Shared progress steps and optional budget targets for family milestones.
alter table public.family_milestones
  add column if not exists budget_goal numeric(12,2),
  add column if not exists budget_currency text;

create table if not exists public.milestone_steps (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.family_milestones(id) on delete cascade,
  title text not null,
  status text not null default 'todo' check (status in ('todo','done')),
  completed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.milestone_steps enable row level security;
create policy "Family can view milestone steps" on public.milestone_steps
  for select using (public.is_family_member(auth.uid()));
create policy "Family can add milestone steps" on public.milestone_steps
  for insert with check (public.is_family_member(auth.uid()));
create policy "Family can update milestone steps" on public.milestone_steps
  for update using (public.is_family_member(auth.uid()));
create policy "Family can delete milestone steps" on public.milestone_steps
  for delete using (public.is_family_member(auth.uid()));

create index if not exists milestone_steps_milestone_idx on public.milestone_steps(milestone_id);
