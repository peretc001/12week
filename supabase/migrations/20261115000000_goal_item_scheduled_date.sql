alter table public.goal_items
  add column scheduled_date date;

create index goal_items_scheduled_date_idx
on public.goal_items(goal_id, scheduled_date)
where scheduled_date is not null;

create or replace function public.update_first_week_date(p_first_week_date date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  previous_first_week_date date;
  date_shift integer;
begin
  select first_week_date
  into previous_first_week_date
  from public.settings
  where user_id = (select auth.uid());

  if not found then
    raise exception 'Settings not found for current user';
  end if;

  date_shift := p_first_week_date - previous_first_week_date;

  update public.settings
  set first_week_date = p_first_week_date
  where user_id = (select auth.uid());

  update public.goals
  set
    start_date = start_date + date_shift,
    end_date = end_date + date_shift
  where user_id = (select auth.uid())
    and start_date is not null
    and end_date is not null;

  update public.goal_occurrences as occurrence
  set scheduled_date = occurrence.scheduled_date + date_shift
  from public.goals as goal
  where occurrence.goal_id = goal.id
    and goal.user_id = (select auth.uid());

  update public.goal_items as item
  set scheduled_date = item.scheduled_date + date_shift
  from public.goals as goal
  where item.goal_id = goal.id
    and goal.user_id = (select auth.uid())
    and item.scheduled_date is not null;
end;
$$;

revoke execute on function public.update_first_week_date(date) from public, anon;
grant execute on function public.update_first_week_date(date) to authenticated;
