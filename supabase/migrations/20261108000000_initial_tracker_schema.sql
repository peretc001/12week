create extension if not exists pgcrypto;

create table public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_week_date date not null,
  theme text not null default 'light'
    check (theme in ('light', 'dark', 'blueprint', 'glass')),
  timezone text not null default 'Europe/Moscow',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_number smallint not null check (week_number between 1 and 12),
  type text not null check (type in ('checklist', 'recurring', 'structured')),
  title text not null check (char_length(trim(title)) between 1 and 120),
  category text check (category is null or char_length(category) <= 80),
  tone text not null default 'accent'
    check (tone in ('accent', 'teal', 'violet', 'amber', 'rose')),
  start_day smallint not null default 1 check (start_day between 1 and 7),
  end_day smallint not null default 7 check (end_day between 1 and 7),
  time_of_day time,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_day <= end_day)
);

create table public.goal_items (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  parent_id uuid,
  title text not null check (char_length(trim(title)) between 1 and 240),
  sort_order integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, goal_id),
  foreign key (parent_id, goal_id)
    references public.goal_items(id, goal_id) on delete cascade
);

create table public.goal_occurrences (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  scheduled_date date not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (goal_id, scheduled_date)
);

create index goals_user_id_idx on public.goals(user_id);
create index goals_user_week_idx on public.goals(user_id, week_number)
  where archived_at is null;
create index goal_items_goal_id_idx on public.goal_items(goal_id);
create index goal_occurrences_goal_id_idx on public.goal_occurrences(goal_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger settings_set_updated_at
before update on public.settings
for each row execute function public.set_updated_at();

create trigger goals_set_updated_at
before update on public.goals
for each row execute function public.set_updated_at();

create trigger goal_items_set_updated_at
before update on public.goal_items
for each row execute function public.set_updated_at();

create trigger goal_occurrences_set_updated_at
before update on public.goal_occurrences
for each row execute function public.set_updated_at();

create function public.update_first_week_date(p_first_week_date date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.settings
  set first_week_date = p_first_week_date
  where user_id = (select auth.uid());

  if not found then
    raise exception 'Settings not found for current user';
  end if;

  update public.goal_occurrences as occurrence
  set scheduled_date = p_first_week_date
    + (((goal.week_number - 1) * 7)
    + (extract(isodow from occurrence.scheduled_date)::integer - 1))
  from public.goals as goal
  where occurrence.goal_id = goal.id
    and goal.user_id = (select auth.uid());
end;
$$;

alter table public.settings enable row level security;
alter table public.goals enable row level security;
alter table public.goal_items enable row level security;
alter table public.goal_occurrences enable row level security;

revoke all on table public.settings from anon, authenticated;
revoke all on table public.goals from anon, authenticated;
revoke all on table public.goal_items from anon, authenticated;
revoke all on table public.goal_occurrences from anon, authenticated;

grant select, insert, update, delete on table public.settings to authenticated;
grant select, insert, update, delete on table public.goals to authenticated;
grant select, insert, update, delete on table public.goal_items to authenticated;
grant select, insert, update, delete on table public.goal_occurrences to authenticated;
revoke execute on function public.update_first_week_date(date) from public, anon;
grant execute on function public.update_first_week_date(date) to authenticated;

create policy "settings_select_own"
on public.settings for select to authenticated
using ((select auth.uid()) = user_id);

create policy "settings_insert_own"
on public.settings for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "settings_update_own"
on public.settings for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "settings_delete_own"
on public.settings for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "goals_select_own"
on public.goals for select to authenticated
using ((select auth.uid()) = user_id);

create policy "goals_insert_own"
on public.goals for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "goals_update_own"
on public.goals for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "goals_delete_own"
on public.goals for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "goal_items_select_own"
on public.goal_items for select to authenticated
using (exists (
  select 1 from public.goals
  where goals.id = goal_items.goal_id
    and goals.user_id = (select auth.uid())
));

create policy "goal_items_insert_own"
on public.goal_items for insert to authenticated
with check (exists (
  select 1 from public.goals
  where goals.id = goal_items.goal_id
    and goals.user_id = (select auth.uid())
));

create policy "goal_items_update_own"
on public.goal_items for update to authenticated
using (exists (
  select 1 from public.goals
  where goals.id = goal_items.goal_id
    and goals.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.goals
  where goals.id = goal_items.goal_id
    and goals.user_id = (select auth.uid())
));

create policy "goal_items_delete_own"
on public.goal_items for delete to authenticated
using (exists (
  select 1 from public.goals
  where goals.id = goal_items.goal_id
    and goals.user_id = (select auth.uid())
));

create policy "goal_occurrences_select_own"
on public.goal_occurrences for select to authenticated
using (exists (
  select 1 from public.goals
  where goals.id = goal_occurrences.goal_id
    and goals.user_id = (select auth.uid())
));

create policy "goal_occurrences_insert_own"
on public.goal_occurrences for insert to authenticated
with check (exists (
  select 1 from public.goals
  where goals.id = goal_occurrences.goal_id
    and goals.user_id = (select auth.uid())
));

create policy "goal_occurrences_update_own"
on public.goal_occurrences for update to authenticated
using (exists (
  select 1 from public.goals
  where goals.id = goal_occurrences.goal_id
    and goals.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.goals
  where goals.id = goal_occurrences.goal_id
    and goals.user_id = (select auth.uid())
));

create policy "goal_occurrences_delete_own"
on public.goal_occurrences for delete to authenticated
using (exists (
  select 1 from public.goals
  where goals.id = goal_occurrences.goal_id
    and goals.user_id = (select auth.uid())
));
