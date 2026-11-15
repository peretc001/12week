-- Separate migration for projects where the initial schema was already applied
-- before update_first_week_date was added to it.
create or replace function public.update_first_week_date(p_first_week_date date)
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

revoke execute on function public.update_first_week_date(date) from public, anon;
grant execute on function public.update_first_week_date(date) to authenticated;
