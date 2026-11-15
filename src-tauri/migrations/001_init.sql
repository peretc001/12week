create table settings (
  id integer primary key check (id = 1),
  first_week_date text not null,
  theme text not null default 'light' check (theme in ('light', 'dark')),
  timezone text not null default 'Europe/Moscow',
  created_at text not null,
  updated_at text not null
);

create table goals (
  id text primary key,
  week_number integer not null check (week_number between 1 and 12),
  type text not null check (type in ('checklist', 'recurring', 'structured')),
  title text not null check (length(trim(title)) between 1 and 120),
  category text check (category is null or length(category) <= 80),
  tone text not null default 'accent' check (tone in ('accent', 'teal', 'violet', 'amber', 'rose')),
  start_day integer not null default 1 check (start_day between 1 and 7),
  end_day integer not null default 7 check (end_day between 1 and 7),
  time_of_day text,
  sort_order integer not null default 0,
  start_date text,
  end_date text,
  archived_at text,
  created_at text not null,
  updated_at text not null,
  check (start_day <= end_day),
  check (
    (start_date is null and end_date is null)
    or (start_date is not null and end_date is not null and start_date <= end_date)
  )
);

create table goal_items (
  id text primary key,
  goal_id text not null references goals(id) on delete cascade,
  parent_id text references goal_items(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240),
  sort_order integer not null default 0,
  scheduled_date text,
  completed_at text,
  created_at text not null,
  updated_at text not null
);

create table goal_occurrences (
  id text primary key,
  goal_id text not null references goals(id) on delete cascade,
  scheduled_date text not null,
  completed_at text,
  created_at text not null,
  updated_at text not null,
  unique (goal_id, scheduled_date)
);

create index goals_week_idx on goals(week_number) where archived_at is null;
create index goal_items_goal_id_idx on goal_items(goal_id);
create index goal_occurrences_goal_id_idx on goal_occurrences(goal_id);
