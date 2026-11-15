import type { Goal, GoalItem, GoalOccurrence, GoalTone, GoalType } from '@/types/database'
import { seed } from '@seed'

export type AppTheme = 'light' | 'dark'

export type TrackerSnapshot = {
  theme: AppTheme
  firstWeekDate: string
  goals: Goal[]
}

type SqlDatabase = {
  execute: (query: string, bindValues?: unknown[]) => Promise<unknown>
  select: <T>(query: string, bindValues?: unknown[]) => Promise<T>
}

type GoalRow = Omit<Goal, 'user_id' | 'goal_items' | 'goal_occurrences'>

let databasePromise: Promise<SqlDatabase> | null = null

function nowIso() {
  return new Date().toISOString()
}

function appTheme(value: string): AppTheme {
  return value === 'dark' ? 'dark' : 'light'
}

function dayModifier(shiftDays: number) {
  return `${shiftDays >= 0 ? '+' : ''}${shiftDays} days`
}

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = openDatabase().catch((error) => {
      databasePromise = null
      throw error
    })
  }
  return databasePromise
}

async function openDatabase() {
  const { default: Database } = await import('@tauri-apps/plugin-sql')
  const database = await Database.load('sqlite:tracker.db')
  await database.execute('PRAGMA foreign_keys = ON')
  await importSeed(database)
  await ensureSettings(database)
  return database
}

async function importSeed(database: SqlDatabase) {
  if (!seed) return
  const existing = await database.select<{ count: number }[]>('select count(*) as count from settings')
  if (existing[0]?.count) return
  const timestamp = nowIso()
  const settings = seed.settings
  await database.execute('BEGIN')
  try {
    await database.execute(
      `insert into settings (id, first_week_date, theme, timezone, created_at, updated_at)
       values (1, $1, $2, $3, $4, $5)`,
      [settings.first_week_date, appTheme(settings.theme), settings.timezone || 'Europe/Moscow', settings.created_at || timestamp, settings.updated_at || timestamp],
    )
    for (const goal of seed.goals) {
      await database.execute(
        `insert into goals (
          id, week_number, type, title, category, tone, start_day, end_day, time_of_day,
          sort_order, start_date, end_date, archived_at, created_at, updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          goal.id, goal.week_number, goal.type, goal.title, goal.category, goal.tone,
          goal.start_day, goal.end_day, goal.time_of_day, goal.sort_order, goal.start_date,
          goal.end_date, goal.archived_at, goal.created_at, goal.updated_at,
        ],
      )
    }
    for (const item of seed.goalItems) {
      await database.execute(
        `insert into goal_items (
          id, goal_id, parent_id, title, sort_order, scheduled_date, completed_at, created_at, updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [item.id, item.goal_id, item.parent_id, item.title, item.sort_order, item.scheduled_date, item.completed_at, item.created_at, item.updated_at],
      )
    }
    for (const occurrence of seed.goalOccurrences) {
      await database.execute(
        `insert into goal_occurrences (id, goal_id, scheduled_date, completed_at, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6)`,
        [occurrence.id, occurrence.goal_id, occurrence.scheduled_date, occurrence.completed_at, occurrence.created_at, occurrence.updated_at],
      )
    }
    await database.execute('COMMIT')
  } catch (error) {
    await database.execute('ROLLBACK')
    throw error
  }
}

async function ensureSettings(database: SqlDatabase) {
  const existing = await database.select<{ count: number }[]>('select count(*) as count from settings')
  if (existing[0]?.count) return
  const timestamp = nowIso()
  const today = new Date()
  const monday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
  const offset = (monday.getUTCDay() + 6) % 7
  monday.setUTCDate(monday.getUTCDate() - offset)
  const firstWeekDate = monday.toISOString().slice(0, 10)
  await database.execute(
    `insert into settings (id, first_week_date, theme, timezone, created_at, updated_at)
     values (1, $1, 'light', 'Europe/Moscow', $2, $2)`,
    [firstWeekDate, timestamp],
  )
}

function groupGoals(rows: GoalRow[], items: GoalItem[], occurrences: GoalOccurrence[]): Goal[] {
  return rows.map((goal) => ({
    ...goal,
    user_id: 'local',
    goal_items: items.filter((item) => item.goal_id === goal.id),
    goal_occurrences: occurrences.filter((occurrence) => occurrence.goal_id === goal.id),
  }))
}

export async function loadStoredGoals() {
  const database = await getDatabase()
  const goals = await database.select<GoalRow[]>(
    `select id, week_number, type, title, category, tone, start_day, end_day, time_of_day,
            sort_order, start_date, end_date, archived_at, created_at, updated_at
     from goals
     where archived_at is null
     order by sort_order asc, created_at asc`,
  )
  const items = await database.select<GoalItem[]>(
    `select id, goal_id, parent_id, title, sort_order, scheduled_date, completed_at, created_at, updated_at
     from goal_items`,
  )
  const occurrences = await database.select<GoalOccurrence[]>(
    `select id, goal_id, scheduled_date, completed_at, created_at, updated_at
     from goal_occurrences`,
  )
  return groupGoals(goals, items, occurrences)
}

export async function loadTracker(): Promise<TrackerSnapshot> {
  const database = await getDatabase()
  const settings = await database.select<{ first_week_date: string; theme: string }[]>(
    'select first_week_date, theme from settings where id = 1',
  )
  const row = settings[0]
  if (!row) throw new Error('Не найдены локальные настройки')
  return {
    theme: appTheme(row.theme),
    firstWeekDate: row.first_week_date,
    goals: await loadStoredGoals(),
  }
}

export async function saveTheme(theme: AppTheme) {
  const database = await getDatabase()
  await database.execute('update settings set theme = $1, updated_at = $2 where id = 1', [theme, nowIso()])
}

export async function shiftCycle(firstWeekDate: string, shiftDays: number) {
  const database = await getDatabase()
  const timestamp = nowIso()
  const modifier = dayModifier(shiftDays)
  await database.execute('BEGIN')
  try {
    await database.execute('update settings set first_week_date = $1, updated_at = $2 where id = 1', [firstWeekDate, timestamp])
    if (shiftDays !== 0) {
      await database.execute(
        `update goals
         set start_date = date(start_date, $1), end_date = date(end_date, $1), updated_at = $2
         where start_date is not null and end_date is not null`,
        [modifier, timestamp],
      )
      await database.execute(
        'update goal_occurrences set scheduled_date = date(scheduled_date, $1), updated_at = $2',
        [modifier, timestamp],
      )
      await database.execute(
        `update goal_items
         set scheduled_date = date(scheduled_date, $1), updated_at = $2
         where scheduled_date is not null`,
        [modifier, timestamp],
      )
    }
    await database.execute('COMMIT')
  } catch (error) {
    await database.execute('ROLLBACK')
    throw error
  }
}

export async function createGoalRecord(input: {
  weekNumber: number
  type: GoalType
  title: string
  category: string
  startDate: string | null
  endDate: string | null
  sortOrder: number
  occurrenceDates: string[]
  items: { title: string; scheduledDate: string | null }[]
}) {
  const database = await getDatabase()
  const id = crypto.randomUUID()
  const timestamp = nowIso()
  await database.execute('BEGIN')
  try {
    await database.execute(
      `insert into goals (
        id, week_number, type, title, category, tone, start_day, end_day,
        sort_order, start_date, end_date, created_at, updated_at
      ) values ($1, $2, $3, $4, $5, 'accent', 1, 7, $6, $7, $8, $9, $9)`,
      [id, input.weekNumber, input.type, input.title, input.category, input.sortOrder, input.startDate, input.endDate, timestamp],
    )
    if (input.type === 'recurring') {
      for (const scheduledDate of input.occurrenceDates) {
        await database.execute(
          `insert into goal_occurrences (id, goal_id, scheduled_date, created_at, updated_at)
           values ($1, $2, $3, $4, $4)`,
          [crypto.randomUUID(), id, scheduledDate, timestamp],
        )
      }
    } else {
      for (const [index, item] of input.items.entries()) {
        await database.execute(
          `insert into goal_items (id, goal_id, title, sort_order, scheduled_date, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $6)`,
          [crypto.randomUUID(), id, item.title, index, item.scheduledDate, timestamp],
        )
      }
    }
    await database.execute('COMMIT')
  } catch (error) {
    await database.execute('ROLLBACK')
    throw error
  }
}

export async function updateGoalRecord(input: {
  id: string
  type: GoalType
  title: string
  category: string
  startDate: string | null
  endDate: string | null
  occurrenceDates: string[]
  existingOccurrences: GoalOccurrence[]
  items: { id: string | null; title: string; scheduledDate: string | null }[]
  existingItems: GoalItem[]
}) {
  const database = await getDatabase()
  const timestamp = nowIso()
  await database.execute('BEGIN')
  try {
    await database.execute(
      `update goals
       set title = $1, category = $2, start_date = $3, end_date = $4, updated_at = $5
       where id = $6`,
      [input.title, input.category, input.startDate, input.endDate, timestamp, input.id],
    )
    if (input.type === 'recurring') {
      const desired = new Set(input.occurrenceDates)
      const existingByDate = new Map(input.existingOccurrences.map((occurrence) => [occurrence.scheduled_date, occurrence]))
      for (const occurrence of input.existingOccurrences) {
        if (!desired.has(occurrence.scheduled_date)) {
          await database.execute('delete from goal_occurrences where id = $1', [occurrence.id])
        }
      }
      for (const scheduledDate of input.occurrenceDates) {
        if (existingByDate.has(scheduledDate)) continue
        await database.execute(
          `insert into goal_occurrences (id, goal_id, scheduled_date, created_at, updated_at)
           values ($1, $2, $3, $4, $4)`,
          [crypto.randomUUID(), input.id, scheduledDate, timestamp],
        )
      }
    } else {
      const retained = input.items.filter((item): item is { id: string; title: string; scheduledDate: string | null } => Boolean(item.id))
      for (const [index, item] of retained.entries()) {
        await database.execute(
          `update goal_items
           set title = $1, scheduled_date = $2, sort_order = $3, updated_at = $4
           where id = $5`,
          [item.title, item.scheduledDate, index, timestamp, item.id],
        )
      }
      const added = input.items.filter((item) => !item.id)
      for (const [index, item] of added.entries()) {
        await database.execute(
          `insert into goal_items (id, goal_id, title, sort_order, scheduled_date, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $6)`,
          [crypto.randomUUID(), input.id, item.title, retained.length + index, item.scheduledDate, timestamp],
        )
      }
      const retainedIds = new Set(retained.map((item) => item.id))
      for (const item of input.existingItems) {
        if (!retainedIds.has(item.id)) await database.execute('delete from goal_items where id = $1', [item.id])
      }
    }
    await database.execute('COMMIT')
  } catch (error) {
    await database.execute('ROLLBACK')
    throw error
  }
}

export async function deleteGoalRecord(id: string) {
  const database = await getDatabase()
  await database.execute('BEGIN')
  try {
    await database.execute('delete from goal_items where goal_id = $1', [id])
    await database.execute('delete from goal_occurrences where goal_id = $1', [id])
    await database.execute('delete from goals where id = $1', [id])
    await database.execute('COMMIT')
  } catch (error) {
    await database.execute('ROLLBACK')
    throw error
  }
}

export async function setItemCompleted(id: string, completedAt: string | null) {
  const database = await getDatabase()
  await database.execute('update goal_items set completed_at = $1, updated_at = $2 where id = $3', [completedAt, nowIso(), id])
}

export async function setOccurrenceCompleted(id: string, completedAt: string | null) {
  const database = await getDatabase()
  await database.execute('update goal_occurrences set completed_at = $1, updated_at = $2 where id = $3', [completedAt, nowIso(), id])
}

export async function setGoalTone(id: string, tone: GoalTone) {
  const database = await getDatabase()
  await database.execute('update goals set tone = $1, updated_at = $2 where id = $3', [tone, nowIso(), id])
}
