alter table public.goals
  add column start_date date,
  add column end_date date;

update public.goals as goal
set
  start_date = settings.first_week_date + ((goal.week_number - 1) * 7),
  end_date = settings.first_week_date + ((goal.week_number - 1) * 7) + 6
from public.settings as settings
where settings.user_id = goal.user_id;

alter table public.goals
  add constraint goals_date_range_check check (
    (start_date is null and end_date is null)
    or
    (start_date is not null and end_date is not null and start_date <= end_date)
  );

create index goals_user_date_range_idx
on public.goals(user_id, start_date, end_date)
where archived_at is null;

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
end;
$$;

revoke execute on function public.update_first_week_date(date) from public, anon;
grant execute on function public.update_first_week_date(date) to authenticated;
