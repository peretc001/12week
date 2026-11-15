import type { Theme } from '@/shared/stageshow/kit'

export type GoalType = 'checklist' | 'recurring' | 'structured'
export type GoalTone = 'accent' | 'teal' | 'violet' | 'amber' | 'rose'

export type Settings = {
  user_id: string
  first_week_date: string
  theme: Theme
  timezone: string
  created_at: string
  updated_at: string
}

export type GoalItem = {
  id: string
  goal_id: string
  parent_id: string | null
  title: string
  sort_order: number
  scheduled_date: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type GoalOccurrence = {
  id: string
  goal_id: string
  scheduled_date: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type Goal = {
  id: string
  user_id: string
  week_number: number
  start_date: string | null
  end_date: string | null
  type: GoalType
  title: string
  category: string | null
  tone: GoalTone
  start_day: number
  end_day: number
  time_of_day: string | null
  sort_order: number
  archived_at: string | null
  created_at: string
  updated_at: string
  goal_items: GoalItem[]
  goal_occurrences: GoalOccurrence[]
}
