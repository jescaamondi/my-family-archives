-- Family Archive v23: practical milestone reminders.
create table if not exists public.milestone_reminders (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.family_milestones(id) on delete cascade,
  step_id uuid references public.milestone_steps(id) on delete cascade,
  contribution_id uuid references public.milestone_contributions(id) on delete cascade,
  reminder_type text not null default 'goal' check (reminder_type in ('goal','step','contribution','custom')),
  title text not null,
  note text,
  remind_at timestamptz not null,
  remind_user_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists milestone_reminders_user_due_idx on public.milestone_reminders(remind_user_id, remind_at);
create index if not exists milestone_reminders_milestone_idx on public.milestone_reminders(milestone_id, remind_at);

alter table public.milestone_reminders enable row level security;

create policy "approved family can view milestone reminders" on public.milestone_reminders
  for select to authenticated
  using (public.is_approved_family_member() and (remind_user_id = auth.uid() or created_by = auth.uid()));

create policy "approved family can add milestone reminders" on public.milestone_reminders
  for insert to authenticated
  with check (public.is_approved_family_member() and created_by = auth.uid());

create policy "reminder recipients or creators can update reminders" on public.milestone_reminders
  for update to authenticated
  using (public.is_approved_family_member() and (remind_user_id = auth.uid() or created_by = auth.uid()))
  with check (public.is_approved_family_member() and (remind_user_id = auth.uid() or created_by = auth.uid()));

create policy "reminder creators or recipients can delete reminders" on public.milestone_reminders
  for delete to authenticated
  using (public.is_approved_family_member() and (remind_user_id = auth.uid() or created_by = auth.uid()));

comment on table public.milestone_reminders is 'Practical reminders for family milestone goals, steps and contributions.';
