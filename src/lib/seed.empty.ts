export type TrackerSeed = {
  settings: {
    first_week_date: string
    theme: string
    timezone: string
    created_at: string
    updated_at: string
  }
  goals: Array<{
    id: string
    week_number: number
    type: 'checklist' | 'recurring' | 'structured'
    title: string
    category: string | null
    tone: 'accent' | 'teal' | 'violet' | 'amber' | 'rose'
    start_day: number
    end_day: number
    time_of_day: string | null
    sort_order: number
    start_date: string | null
    end_date: string | null
    archived_at: string | null
    created_at: string
    updated_at: string
  }>
  goalItems: Array<{
    id: string
    goal_id: string
    parent_id: string | null
    title: string
    sort_order: number
    scheduled_date: string | null
    completed_at: string | null
    created_at: string
    updated_at: string
  }>
  goalOccurrences: Array<{
    id: string
    goal_id: string
    scheduled_date: string
    completed_at: string | null
    created_at: string
    updated_at: string
  }>
}

export const seed: TrackerSeed | null = null
