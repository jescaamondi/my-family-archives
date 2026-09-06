-- Milestone contributions can be time/tasks, money, or resources.
alter table public.milestone_contributions
  add column if not exists contribution_type text not null default 'task'
    check (contribution_type in ('task','money','resource')),
  add column if not exists amount numeric(12,2),
  add column if not exists currency text;

create index if not exists milestone_contributions_milestone_type_idx
  on public.milestone_contributions(milestone_id, contribution_type);
