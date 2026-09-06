-- Family Archive v24: scheduled push notifications for milestone reminders.
create table if not exists public.milestone_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists milestone_push_subscriptions_user_idx on public.milestone_push_subscriptions(user_id);

alter table public.milestone_push_subscriptions enable row level security;

create policy "users manage their own push subscriptions" on public.milestone_push_subscriptions
  for all to authenticated
  using (user_id = auth.uid() and public.is_approved_family_member())
  with check (user_id = auth.uid() and public.is_approved_family_member());

create table if not exists public.milestone_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.milestone_reminders(id) on delete cascade,
  subscription_id uuid not null references public.milestone_push_subscriptions(id) on delete cascade,
  delivered_at timestamptz,
  attempted_at timestamptz not null default now(),
  unique(reminder_id, subscription_id)
);

create index if not exists milestone_reminder_deliveries_due_idx on public.milestone_reminder_deliveries(reminder_id, delivered_at);

alter table public.milestone_reminder_deliveries enable row level security;

create policy "users can view their own reminder deliveries" on public.milestone_reminder_deliveries
  for select to authenticated
  using (exists (
    select 1 from public.milestone_push_subscriptions s
    where s.id = subscription_id and s.user_id = auth.uid()
  ));

-- Scheduling is intentionally configured after deployment so the project can use
-- Supabase Vault for the Edge Function URL and service-role key. See
-- supabase/functions/send-milestone-reminders/README.md for the exact commands.
