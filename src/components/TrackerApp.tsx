'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ConfigProvider, DatePicker, theme as antdTheme } from 'antd'
import ruRU from 'antd/locale/ru_RU'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import {
  Badge, Button, Card, Checkbox, Dialog, Field, Gantt, Icon, Meter, Row,
  Popover, Segmented, Select, Spinner, Stage, type GanttColumn, type GanttRow,
} from '@/shared/stageshow/kit'
import { StarMark } from '@/shared/stageshow/kit/parts/StarMark'
import type { Goal, GoalItem, GoalOccurrence, GoalType } from '@/types/database'
import {
  createGoalRecord, deleteGoalRecord, loadStoredGoals, loadTracker, saveGoalOrder, saveTheme, setGoalTone,
  setItemCompleted, setOccurrenceCompleted, shiftCycle, updateGoalRecord, type AppTheme,
} from '@/lib/tracker-db'
import './TrackerApp.css'

dayjs.locale('ru')

const themeOptions: { value: AppTheme; label: string }[] = [
  { value: 'light', label: 'Белая' },
  { value: 'dark', label: 'Чёрная' },
]
const categoryOptions = [
  { value: 'health', label: 'Здоровье' },
  { value: 'work', label: 'Работа' },
  { value: 'personal', label: 'Личное' },
]
const dateModeOptions = [
  { value: 'all', label: 'Весь период' },
  { value: 'range', label: 'Указать даты' },
]
const categoryLabels = Object.fromEntries(categoryOptions.map((option) => [option.value, option.label]))
const dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const monthLabels = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const dayMs = 86_400_000
const prerenderSafeCycleStart = '2000-01-03'

function dateFromIso(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}
function isoFromDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}
function currentDateIso() {
  const now = new Date()
  return isoFromDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
}
function formatInputDate(iso: string) {
  const date = dateFromIso(iso)
  return `${String(date.getUTCDate()).padStart(2, '0')}.${String(date.getUTCMonth() + 1).padStart(2, '0')}.${date.getUTCFullYear()}`
}
function parseInputDate(value: string) {
  const match = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return isoFromDate(date)
}
function formatShortDate(iso: string) {
  const date = dateFromIso(iso)
  return `${date.getUTCDate()} ${monthLabels[date.getUTCMonth()]}`
}

function DateField({ label, value, onValueChange, focused = false, status, min, max }: {
  label: string
  value: string
  onValueChange: (value: string) => void
  focused?: boolean
  status?: 'valid' | 'error'
  min?: string
  max?: string
}) {
  const parsedValue = parseInputDate(value)

  return (
    <label className="date-field">
      <span className="ss-field__label">{label}</span>
      <DatePicker
      value={parsedValue ? dayjs(parsedValue) : null}
      minDate={min ? dayjs(min) : undefined}
      maxDate={max ? dayjs(max) : undefined}
      format={{ format: 'DD.MM.YYYY', type: 'mask' }}
      placeholder="ДД.ММ.ГГГГ"
      allowClear={false}
      autoFocus={focused}
      preserveInvalidOnBlur
      status={status === 'error' ? 'error' : undefined}
      aria-label={label}
      onChange={(date) => onValueChange(date ? date.format('DD.MM.YYYY') : '')}
    />
    </label>
  )
}
function formatDateRange(start: Date, end: Date) {
  if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${monthLabels[end.getUTCMonth()]}`
  }
  return `${start.getUTCDate()} ${monthLabels[start.getUTCMonth()]} — ${end.getUTCDate()} ${monthLabels[end.getUTCMonth()]}`
}
function getWeekLabels(cycleStartIso: string) {
  const cycleStart = dateFromIso(cycleStartIso).getTime()
  return Array.from({ length: 12 }, (_, index) => {
    const start = new Date(cycleStart + index * 7 * dayMs)
    return formatDateRange(start, new Date(start.getTime() + 6 * dayMs))
  })
}
function dateWithOffset(iso: string, days: number) {
  return isoFromDate(new Date(dateFromIso(iso).getTime() + days * dayMs))
}
function weekStartIso(week: number, cycleStartIso: string) {
  return dateWithOffset(cycleStartIso, (week - 1) * 7)
}
function currentCycleSelection(cycleStartIso: string) {
  const dayOffset = Math.floor((dateFromIso(currentDateIso()).getTime() - dateFromIso(cycleStartIso).getTime()) / dayMs)
  const boundedOffset = Math.min(83, Math.max(0, dayOffset))
  return {
    week: Math.floor(boundedOffset / 7) + 1,
    day: (boundedOffset % 7) + 1,
  }
}
function getWeekColumns(week: number, cycleStartIso: string): GanttColumn[] {
  const weekStart = dateFromIso(weekStartIso(week, cycleStartIso)).getTime()
  const todayIso = currentDateIso()
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart + index * dayMs)
    const weekdayIndex = (date.getUTCDay() + 6) % 7
    const dateIso = isoFromDate(date)
    return { id: dateIso, label: dayLabels[weekdayIndex], meta: `${date.getUTCDate()} ${monthLabels[date.getUTCMonth()]}`, isToday: dateIso === todayIso }
  })
}
function goalWeekRange(goal: Goal, cycleStartIso: string) {
  if (goal.start_date === undefined || goal.end_date === undefined) return { start: goal.week_number, end: goal.week_number }
  if (!goal.start_date || !goal.end_date) return { start: 1, end: 12 }
  const cycleStart = dateFromIso(cycleStartIso).getTime()
  const start = Math.floor((dateFromIso(goal.start_date).getTime() - cycleStart) / (7 * dayMs)) + 1
  const end = Math.floor((dateFromIso(goal.end_date).getTime() - cycleStart) / (7 * dayMs)) + 1
  return { start: Math.min(12, Math.max(1, start)), end: Math.min(12, Math.max(1, end)) }
}
function goalDayRange(goal: Goal, week: number, cycleStartIso: string) {
  const weekStart = weekStartIso(week, cycleStartIso)
  const weekEnd = dateWithOffset(weekStart, 6)
  if (goal.start_date === undefined || goal.end_date === undefined) return { start: 1, end: 7 }
  if (!goal.start_date || !goal.end_date) return { start: 1, end: 7 }
  const visibleStart = goal.start_date > weekStart ? goal.start_date : weekStart
  const visibleEnd = goal.end_date < weekEnd ? goal.end_date : weekEnd
  return {
    start: Math.floor((dateFromIso(visibleStart).getTime() - dateFromIso(weekStart).getTime()) / dayMs) + 1,
    end: Math.floor((dateFromIso(visibleEnd).getTime() - dateFromIso(weekStart).getTime()) / dayMs) + 1,
  }
}
function recurringDates(selectedDays: number[], startIso: string, endIso: string) {
  const dates: string[] = []
  for (let time = dateFromIso(startIso).getTime(), end = dateFromIso(endIso).getTime(); time <= end; time += dayMs) {
    const date = new Date(time)
    if (selectedDays.includes((date.getUTCDay() + 6) % 7)) dates.push(isoFromDate(date))
  }
  return dates
}
type GoalUnit = GoalItem | GoalOccurrence

function goalUnits(goal: Goal): GoalUnit[] {
  return goal.type === 'recurring' ? goal.goal_occurrences : goal.goal_items
}
function unitsProgress(units: GoalUnit[]) {
  return units.length ? Math.round((units.filter((unit) => unit.completed_at).length / units.length) * 100) : 0
}
function areUnitsCompleted(units: GoalUnit[]) {
  return units.length > 0 && units.every((unit) => unit.completed_at)
}
function goalProgress(goal: Goal) {
  return unitsProgress(goalUnits(goal))
}
function isGoalCompleted(goal: Goal) {
  return areUnitsCompleted(goalUnits(goal))
}
function isPrimaryGoal(goal: Goal) {
  return goal.tone === 'violet'
}
function itemsInListOrder(items: GoalItem[]) {
  return [...items].sort((first, second) => first.sort_order - second.sort_order || first.created_at.localeCompare(second.created_at))
}
function compareWeekGoals(first: Goal, second: Goal) {
  const rank = (goal: Goal) => (isPrimaryGoal(goal) ? 0 : 1)
  return rank(first) - rank(second) || first.sort_order - second.sort_order || first.created_at.localeCompare(second.created_at)
}
function reorderList<T>(items: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
function PrimaryStar({ active, title, onClick }: { active: boolean; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="ss-goal-star"
      data-active={active || undefined}
      aria-pressed={active}
      aria-label={active ? `Снять главную задачу: ${title}` : `Сделать главной задачей: ${title}`}
      title={active ? 'Главная задача' : 'Сделать главной'}
      onClick={onClick}
    >
      <StarMark active={active} size={18} />
    </button>
  )
}
function GoalTypeCard({ active, disabled = false, title, description, icon, onClick }: { active: boolean; disabled?: boolean; title: string; description: string; icon: 'check' | 'clock' | 'grip'; onClick: () => void }) {
  return (
    <Card className="goal-type-card" data-active={active || undefined} data-disabled={disabled || undefined} aria-disabled={disabled} onClick={disabled ? undefined : onClick}>
      <span className="goal-type-card__icon"><Icon name={icon} size={18} /></span>
      <span className="goal-type-card__copy"><strong>{title}</strong><small>{description}</small></span>
    </Card>
  )
}

export function TrackerApp() {
  const [theme, setTheme] = useState<AppTheme>('light')
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [selectedDay, setSelectedDay] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
  const [cycleSettingsOpen, setCycleSettingsOpen] = useState(false)
  const [cycleStart, setCycleStart] = useState(prerenderSafeCycleStart)
  const [cycleStartDraft, setCycleStartDraft] = useState(formatInputDate(prerenderSafeCycleStart))
  const [cycleDateError, setCycleDateError] = useState(false)
  const [cycleSaveError, setCycleSaveError] = useState('')
  const [goalType, setGoalType] = useState<GoalType>('checklist')
  const [newGoalTitle, setNewGoalTitle] = useState('')
  const [newGoalCategory, setNewGoalCategory] = useState('personal')
  const [goalDateMode, setGoalDateMode] = useState<'all' | 'range'>('all')
  const [goalStartDate, setGoalStartDate] = useState(formatInputDate(prerenderSafeCycleStart))
  const [goalEndDate, setGoalEndDate] = useState(formatInputDate(dateWithOffset(prerenderSafeCycleStart, 6)))
  useEffect(() => {
    const start = parseInputDate(goalStartDate)
    const end = parseInputDate(goalEndDate)
    if (start && end && start > end) setGoalEndDate(goalStartDate)
  }, [goalStartDate, goalEndDate])
  const [newGoalItems, setNewGoalItems] = useState([''])
  const [newGoalItemDates, setNewGoalItemDates] = useState<(string | null)[]>([null])
  const [goalItemIds, setGoalItemIds] = useState<(string | null)[]>([null])
  const [newGoalDays, setNewGoalDays] = useState([false, false, false, false, false, false, false])
  const [goalFormError, setGoalFormError] = useState('')
  const [savingGoal, setSavingGoal] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingGoal, setDeletingGoal] = useState(false)
  const [draftDragIndex, setDraftDragIndex] = useState<number | null>(null)

  const loadGoals = useCallback(async () => {
    const data = await loadStoredGoals()
    setGoals(data.map((goal) => ({ ...goal, goal_items: itemsInListOrder(goal.goal_items ?? []) })))
  }, [])

  useEffect(() => {
    let active = true
    async function bootstrap() {
      try {
        const snapshot = await loadTracker()
        if (!active) return
        setTheme(snapshot.theme)
        setCycleStart(snapshot.firstWeekDate)
        setCycleStartDraft(formatInputDate(snapshot.firstWeekDate))
        const currentSelection = currentCycleSelection(snapshot.firstWeekDate)
        setSelectedWeek(currentSelection.week)
        setSelectedDay(currentSelection.day)
        setGoals(snapshot.goals.map((goal) => ({ ...goal, goal_items: itemsInListOrder(goal.goal_items ?? []) })))
        document.documentElement.dataset.theme = snapshot.theme
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'Не удалось загрузить данные')
      } finally {
        if (active) setLoading(false)
      }
    }
    void bootstrap()
    return () => { active = false }
  }, [])

  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])

  const weekLabels = useMemo(() => getWeekLabels(cycleStart), [cycleStart])
  const cycleRange = useMemo(() => {
    const start = dateFromIso(cycleStart)
    return formatDateRange(start, new Date(start.getTime() + 83 * dayMs))
  }, [cycleStart])
  const weekTitle = `Неделя ${selectedWeek} · ${weekLabels[selectedWeek - 1]}`
  const weekColumns = useMemo(() => getWeekColumns(selectedWeek, cycleStart), [selectedWeek, cycleStart])
  const weekGoals = useMemo(() => goals.filter((goal) => {
    const range = goalWeekRange(goal, cycleStart)
    return range.start <= selectedWeek && range.end >= selectedWeek
  }), [goals, selectedWeek, cycleStart])
  const selectedWeekStart = weekStartIso(selectedWeek, cycleStart)
  const selectedWeekEnd = dateWithOffset(selectedWeekStart, 6)
  const isCompletedForSelectedWeek = (goal: Goal) => goal.type === 'recurring'
    ? areUnitsCompleted(goal.goal_occurrences.filter((occurrence) => occurrence.scheduled_date >= selectedWeekStart && occurrence.scheduled_date <= selectedWeekEnd))
    : isGoalCompleted(goal)
  const orderedWeekGoals = useMemo(
    () => [...weekGoals].sort(compareWeekGoals),
    [weekGoals],
  )
  const ganttRows = useMemo<GanttRow[]>(() => orderedWeekGoals.map((goal) => {
    const range = goalDayRange(goal, selectedWeek, cycleStart)
    const visibleOccurrences = goal.goal_occurrences.filter((occurrence) => occurrence.scheduled_date >= selectedWeekStart && occurrence.scheduled_date <= selectedWeekEnd)
    const completedForSelectedWeek = goal.type === 'recurring' ? areUnitsCompleted(visibleOccurrences) : isGoalCompleted(goal)
    const overdue = Boolean(goal.end_date && goal.end_date < currentDateIso() && !completedForSelectedWeek)
    const marks = goal.type === 'recurring' ? undefined : [...new Set(goal.goal_items.flatMap((item) => {
      if (!item.scheduled_date || item.scheduled_date < selectedWeekStart || item.scheduled_date > selectedWeekEnd) return []
      return [Math.floor((dateFromIso(item.scheduled_date).getTime() - dateFromIso(selectedWeekStart).getTime()) / dayMs) + 1]
    }))].sort((first, second) => first - second)
    const progressSegments = goal.type === 'recurring' && !completedForSelectedWeek
      ? visibleOccurrences
          .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
          .reduce<{ segments: { startWeek: number; endWeek: number }[]; previousDay: number }>((result, occurrence) => {
            const day = Math.floor((dateFromIso(occurrence.scheduled_date).getTime() - dateFromIso(selectedWeekStart).getTime()) / dayMs) + 1
            if (occurrence.completed_at) {
              const startWeek = Math.max(range.start, result.previousDay + 1)
              const endWeek = Math.min(range.end, day)
              if (startWeek <= endWeek) result.segments.push({ startWeek, endWeek })
            }
            result.previousDay = day
            return result
          }, { segments: [], previousDay: range.start - 1 }).segments
      : undefined
    return {
      id: goal.id,
      title: goal.title,
      startWeek: range.start,
      endWeek: range.end,
      tone: isPrimaryGoal(goal) ? 'violet' : overdue ? 'rose' : completedForSelectedWeek ? 'teal' : 'accent',
      primary: isPrimaryGoal(goal),
      progress: goal.type === 'checklist' ? goalProgress(goal) : undefined,
      progressSegments,
      marks: range.end === range.start ? undefined : marks?.length ? marks : undefined,
    }
  }), [orderedWeekGoals, selectedWeek, selectedWeekStart, selectedWeekEnd, cycleStart])
  const weekUnits = weekGoals.reduce<GoalUnit[]>((units, goal) => [
    ...units,
    ...(goal.type === 'recurring'
      ? goal.goal_occurrences.filter((occurrence) => occurrence.scheduled_date >= selectedWeekStart && occurrence.scheduled_date <= selectedWeekEnd)
      : goal.goal_items),
  ], [])
  const completedUnits = weekUnits.filter((unit) => unit.completed_at).length
  const completedGoals = weekGoals.filter(isCompletedForSelectedWeek).length
  const weekProgress = weekUnits.length ? Math.round((completedUnits / weekUnits.length) * 100) : 0
  const cycleProgress = goals.length ? Math.round(goals.reduce((sum, goal) => sum + goalProgress(goal), 0) / goals.length) : 0

  const selectWeek = (week: number) => { setSelectedWeek(Math.min(12, Math.max(1, week))); setSelectedDay(1) }
  const changeTheme = async (nextTheme: AppTheme) => {
    const previous = theme
    setTheme(nextTheme)
    setMessage('')
    try {
      await saveTheme(nextTheme)
    } catch {
      setTheme(previous)
      setMessage('Не удалось сохранить тему')
    }
  }
  const openCycleSettings = () => {
    setCycleStartDraft(formatInputDate(cycleStart)); setCycleDateError(false); setCycleSaveError(''); setCycleSettingsOpen(true)
  }
  const saveCycleSettings = async () => {
    const parsed = parseInputDate(cycleStartDraft)
    if (!parsed) { setCycleDateError(true); setCycleSaveError(''); return }
    setCycleSaveError('')
    const dateShift = Math.round((dateFromIso(parsed).getTime() - dateFromIso(cycleStart).getTime()) / dayMs)
    try {
      await shiftCycle(parsed, dateShift)
    } catch (error) {
      setCycleSaveError(`Не удалось сохранить дату: ${error instanceof Error ? error.message : 'ошибка записи'}`)
      return
    }
    await loadGoals().catch(() => undefined)
    const currentSelection = currentCycleSelection(parsed)
    setCycleStart(parsed); setSelectedWeek(currentSelection.week); setSelectedDay(currentSelection.day); setCycleDateError(false); setCycleSettingsOpen(false)
  }
  const resetGoalForm = () => {
    const defaultStart = weekStartIso(selectedWeek, cycleStart)
    setEditingGoalId(null)
    setGoalType('checklist'); setNewGoalTitle(''); setNewGoalCategory('personal'); setNewGoalItems([''])
    setNewGoalItemDates([null])
    setGoalDateMode('all'); setGoalStartDate(formatInputDate(defaultStart)); setGoalEndDate(formatInputDate(dateWithOffset(defaultStart, 6)))
    setGoalItemIds([null])
    setNewGoalDays([false, false, false, false, false, false, false]); setGoalFormError('')
    setDeleteConfirmOpen(false); setDeletingGoal(false)
  }
  const openCreateGoal = () => { resetGoalForm(); setDialogOpen(true) }
  const closeGoalDialog = () => { setDialogOpen(false); resetGoalForm() }
  const openGoalEditor = (goal: Goal) => {
    const sortedItems = itemsInListOrder(goal.goal_items)
    const legacyStart = weekStartIso(goal.week_number, cycleStart)
    const hasRange = goal.start_date === undefined ? true : Boolean(goal.start_date && goal.end_date)
    const startDate = goal.start_date ?? legacyStart
    const endDate = goal.end_date ?? dateWithOffset(legacyStart, 6)
    setEditingGoalId(goal.id)
    setGoalType(goal.type)
    setNewGoalTitle(goal.title)
    setNewGoalCategory(goal.category ?? 'personal')
    setGoalDateMode(hasRange ? 'range' : 'all')
    setGoalStartDate(formatInputDate(startDate))
    setGoalEndDate(formatInputDate(endDate))
    setNewGoalItems(goal.type === 'recurring' ? [''] : sortedItems.length ? sortedItems.map((item) => item.title) : [''])
    setNewGoalItemDates(goal.type === 'recurring' ? [null] : sortedItems.length ? sortedItems.map((item) => item.scheduled_date) : [null])
    setGoalItemIds(goal.type === 'recurring' ? [null] : sortedItems.length ? sortedItems.map((item) => item.id) : [null])
    setNewGoalDays(dayLabels.map((_, index) => goal.goal_occurrences.some((occurrence) => (
      (dateFromIso(occurrence.scheduled_date).getUTCDay() + 6) % 7 === index
    ))))
    setGoalFormError('')
    setDialogOpen(true)
  }
  const readGoalDateRange = () => {
    if (goalDateMode === 'all') {
      if (goalType === 'recurring') return { startDate: null, endDate: null }
      const itemDates = newGoalItems.flatMap((item, index) => {
        const date = newGoalItemDates[index]
        return item.trim() && date ? [date] : []
      }).sort()
      if (!itemDates.length) return { startDate: null, endDate: null }
      const startDate = itemDates[0]
      const endDate = itemDates[itemDates.length - 1]
      const cycleEnd = dateWithOffset(cycleStart, 83)
      if (startDate < cycleStart || endDate > cycleEnd) { setGoalFormError('Дата пункта должна быть в пределах 12-недельного периода'); return null }
      return { startDate, endDate }
    }
    const startDate = parseInputDate(goalStartDate)
    const endDate = parseInputDate(goalEndDate)
    if (!startDate || !endDate) { setGoalFormError('Введите даты в формате ДД.ММ.ГГГГ'); return null }
    if (startDate > endDate) { setGoalFormError('Дата начала должна быть раньше даты окончания'); return null }
    const cycleEnd = dateWithOffset(cycleStart, 83)
    if (startDate < cycleStart || endDate > cycleEnd) { setGoalFormError('Даты должны быть в пределах 12-недельного периода'); return null }
    return { startDate, endDate }
  }
  const createGoal = async () => {
    const title = newGoalTitle.trim()
    if (!title) { setGoalFormError('Введите название цели'); return }
    const selectedDays = newGoalDays.flatMap((selected, index) => selected ? [index] : [])
    if (goalType === 'recurring' && !selectedDays.length) { setGoalFormError('Выберите хотя бы один день'); return }
    const dateRange = readGoalDateRange()
    if (!dateRange) return
    const datedItemOutsideRange = goalType !== 'recurring' && newGoalItemDates.find((date) => date && (
      date < (dateRange.startDate ?? cycleStart) || date > (dateRange.endDate ?? dateWithOffset(cycleStart, 83))
    ))
    if (datedItemOutsideRange) { setGoalFormError('Дата пункта должна быть в пределах периода цели'); return }
    setSavingGoal(true); setGoalFormError('')
    const rangeStart = dateRange.startDate ?? cycleStart
    const rangeEnd = dateRange.endDate ?? dateWithOffset(cycleStart, 83)
    try {
      await createGoalRecord({
        weekNumber: selectedWeek,
        type: goalType,
        title,
        category: newGoalCategory,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        sortOrder: goals.length,
        occurrenceDates: goalType === 'recurring' ? recurringDates(selectedDays, rangeStart, rangeEnd) : [],
        items: goalType === 'recurring' ? [] : newGoalItems
          .map((item, index) => ({ title: item.trim(), scheduledDate: newGoalItemDates[index] ?? null }))
          .filter((item) => item.title),
      })
      await loadGoals()
      setDialogOpen(false)
      resetGoalForm()
    } catch (error) {
      setGoalFormError(error instanceof Error ? error.message : 'Не удалось создать цель')
    } finally {
      setSavingGoal(false)
    }
  }
  const updateGoal = async () => {
    const goal = goals.find((candidate) => candidate.id === editingGoalId)
    if (!goal) { setGoalFormError('Цель не найдена'); return }
    const title = newGoalTitle.trim()
    if (!title) { setGoalFormError('Введите название цели'); return }
    const selectedDays = newGoalDays.flatMap((selected, index) => selected ? [index] : [])
    if (goal.type === 'recurring' && !selectedDays.length) { setGoalFormError('Выберите хотя бы один день'); return }
    const dateRange = readGoalDateRange()
    if (!dateRange) return
    const datedItemOutsideRange = goal.type !== 'recurring' && newGoalItemDates.find((date) => date && (
      date < (dateRange.startDate ?? cycleStart) || date > (dateRange.endDate ?? dateWithOffset(cycleStart, 83))
    ))
    if (datedItemOutsideRange) { setGoalFormError('Дата пункта должна быть в пределах периода цели'); return }
    setSavingGoal(true); setGoalFormError('')
    const rangeStart = dateRange.startDate ?? cycleStart
    const rangeEnd = dateRange.endDate ?? dateWithOffset(cycleStart, 83)
    const drafts = newGoalItems
      .map((item, index) => ({ id: goalItemIds[index] ?? null, title: item.trim(), scheduledDate: newGoalItemDates[index] ?? null }))
      .filter((item) => item.title)
    try {
      await updateGoalRecord({
        id: goal.id,
        type: goal.type,
        title,
        category: newGoalCategory,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        occurrenceDates: goal.type === 'recurring' ? recurringDates(selectedDays, rangeStart, rangeEnd) : [],
        existingOccurrences: goal.goal_occurrences,
        items: goal.type === 'recurring' ? [] : drafts,
        existingItems: goal.goal_items,
      })
      await loadGoals()
      closeGoalDialog()
    } catch (error) {
      setGoalFormError(error instanceof Error ? error.message : 'Не удалось сохранить цель')
      await loadGoals().catch(() => undefined)
    } finally {
      setSavingGoal(false)
    }
  }
  const deleteGoal = async () => {
    if (!editingGoalId) return
    setDeletingGoal(true); setGoalFormError('')
    try {
      await deleteGoalRecord(editingGoalId)
    } catch (error) {
      setGoalFormError(error instanceof Error ? error.message : 'Не удалось удалить цель')
      setDeleteConfirmOpen(false)
      setDeletingGoal(false)
      return
    }
    try { await loadGoals(); closeGoalDialog() }
    catch (loadError) { setMessage(loadError instanceof Error ? loadError.message : 'Цель удалена, но список не обновился') }
    finally { setDeletingGoal(false) }
  }
  const updateItem = async (item: GoalItem, checked: boolean) => {
    const completedAt = checked ? new Date().toISOString() : null
    setGoals((current) => current.map((goal) => ({ ...goal, goal_items: goal.goal_items.map((candidate) => candidate.id === item.id ? { ...candidate, completed_at: completedAt } : candidate) })))
    try {
      await setItemCompleted(item.id, completedAt)
    } catch {
      setMessage('Не удалось сохранить пункт')
      await loadGoals().catch(() => undefined)
    }
  }
  const updateOccurrence = async (occurrence: GoalOccurrence, checked: boolean) => {
    const completedAt = checked ? new Date().toISOString() : null
    setGoals((current) => current.map((goal) => ({ ...goal, goal_occurrences: goal.goal_occurrences.map((candidate) => candidate.id === occurrence.id ? { ...candidate, completed_at: completedAt } : candidate) })))
    try {
      await setOccurrenceCompleted(occurrence.id, completedAt)
    } catch {
      setMessage('Не удалось сохранить повторение')
      await loadGoals().catch(() => undefined)
    }
  }
  const togglePrimaryGoal = async (goalId: string) => {
    const goal = goals.find((candidate) => candidate.id === goalId)
    if (!goal) return
    const makePrimary = !isPrimaryGoal(goal)
    const previous = goals
    setGoals((current) => current.map((candidate) => (
      candidate.id === goalId ? { ...candidate, tone: makePrimary ? 'violet' : 'accent' } : candidate
    )))
    try {
      await setGoalTone(goalId, makePrimary ? 'violet' : 'accent')
    } catch {
      setGoals(previous)
      setMessage('Не удалось сохранить главную задачу')
    }
  }
  const reorderWeekGoals = async (from: number, to: number) => {
    if (from === to) return
    const nextWeek = reorderList(orderedWeekGoals, from, to)
    const weekIds = new Set(orderedWeekGoals.map((goal) => goal.id))
    const global = [...goals].sort(compareWeekGoals)
    const slots: number[] = []
    global.forEach((goal, index) => { if (weekIds.has(goal.id)) slots.push(index) })
    const nextGlobal = [...global]
    slots.forEach((slot, index) => { nextGlobal[slot] = nextWeek[index] })
    const order = new Map(nextGlobal.map((goal, index) => [goal.id, index]))
    const previous = goals
    setGoals((current) => current.map((goal) => order.has(goal.id) ? { ...goal, sort_order: order.get(goal.id)! } : goal))
    try {
      await saveGoalOrder(nextGlobal.map((goal) => goal.id))
    } catch {
      setGoals(previous)
      setMessage('Не удалось сохранить порядок')
    }
  }
  const moveDraftItem = (from: number, to: number) => {
    if (from === to) return
    setNewGoalItems((items) => reorderList(items, from, to))
    setNewGoalItemDates((dates) => reorderList(dates, from, to))
    setGoalItemIds((ids) => reorderList(ids, from, to))
  }
  const draftDragIndexRef = useRef(0)
  const startDraftDrag = (from: number, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const height = event.currentTarget.closest('.goal-item-editor')?.getBoundingClientRect().height ?? 48
    const startY = event.clientY
    draftDragIndexRef.current = from
    setDraftDragIndex(from)
    const move = (pointer: PointerEvent) => {
      const count = newGoalItems.length
      const next = Math.max(0, Math.min(count - 1, from + Math.round((pointer.clientY - startY) / height)))
      const current = draftDragIndexRef.current
      if (next === current) return
      draftDragIndexRef.current = next
      setDraftDragIndex(next)
      moveDraftItem(current, next)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDraftDragIndex(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <ConfigProvider
      locale={ruRU}
      theme={{
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: { borderRadius: 10, controlHeight: 38 },
      }}
    >
    <main className="prototype-host">
      <Stage width={1600} height={1000} theme={theme} fidelity="realistic" className="tracker-stage">
        {() => (
          <div className="tracker-product">
            <aside className="tracker-sidebar">
              <div className="tracker-wordmark">12 недель</div>
              <div className="tracker-nav">
                <Row selected lead={<Icon name="calendar" size={16} filled />} title="План" />
                <Row lead={<Icon name="bolt" size={16} filled />} title="Цели" meta={<Badge tone="accent">{goals.length}</Badge>} />
                <Row lead={<Icon name="check" size={16} filled />} title="Недели" />
                <Row lead={<Icon name="gear" size={16} filled />} title="Настройки" />
              </div>
              <Card tone="sunken" className="sidebar-focus">
                <span className="micro-label">Прогресс цикла</span>
                <strong>{goals.length ? `${cycleProgress}% выполнено` : 'Добавьте первую цель'}</strong>
                <Meter value={cycleProgress / 100} />
                <small>{goals.length} {goals.length === 1 ? 'цель' : 'целей'}</small>
              </Card>
            </aside>
            <section className="tracker-main">
              <header className="tracker-header">
                <div className="tracker-heading">
                  <div className="tracker-heading__title">12 недель</div>
                  <Button variant="tertiary" icon={<Icon name="calendar" size={12} />} onClick={openCycleSettings}>{cycleRange}</Button>
                </div>
                <div className="tracker-actions">
                  {message && <Badge tone="danger">Ошибка</Badge>}
                  <Select value={theme} options={themeOptions} onChange={changeTheme} ariaLabel="Тема интерфейса" />
                  <Button size="large" variant="primary" icon={<Icon name="plus" size={15} />} onClick={openCreateGoal}>Добавить цель</Button>
                </div>
              </header>
              <div className="tracker-workspace">
                <section className="gantt-panel">
                  <div className="panel-heading">
                    <div><span className="micro-label">Неделя {selectedWeek} из 12</span><div className="panel-title">{weekLabels[selectedWeek - 1]}</div></div>
                    <Badge tone={weekGoals.length ? 'success' : 'neutral'} dot>{weekGoals.length ? 'План сохранён' : 'Нет целей'}</Badge>
                  </div>
                  <div className="week-switcher">
                    <Button className="week-switcher__arrow" variant="ghost" aria-label="Предыдущая неделя" onClick={() => selectWeek(selectedWeek - 1)}><Icon name="chevron-right" size={15} style={{ transform: 'rotate(180deg)' }} /></Button>
                    <Segmented items={weekLabels.map((_, index) => `Н${index + 1}`)} value={selectedWeek - 1} onChange={(index) => selectWeek(index + 1)} />
                    <Button className="week-switcher__arrow" variant="ghost" aria-label="Следующая неделя" onClick={() => selectWeek(selectedWeek + 1)}><Icon name="chevron-right" size={15} /></Button>
                  </div>
                  {loading ? (
                    <Card className="tracker-state" tone="sunken"><Spinner /><strong>Загружаем данные</strong></Card>
                  ) : message && !goals.length ? (
                    <Card className="tracker-state" tone="sunken"><Icon name="gear" size={22} /><strong>Не удалось открыть данные</strong><small>{message}</small></Card>
                  ) : weekGoals.length ? (
                    <Gantt columns={weekColumns} cornerLabel="Цели недели" rows={ganttRows} selectedWeek={selectedDay} onWeekSelect={setSelectedDay} onRowSelect={(row) => setSelectedDay(row.startWeek)} onTogglePrimary={(row) => void togglePrimaryGoal(row.id)} onReorder={(from, to) => void reorderWeekGoals(from, to)} />
                  ) : (
                    <Card className="tracker-state" tone="sunken"><Icon name="calendar" size={22} /><strong>Неделя пока пустая</strong><small>Добавьте первую цель на эту неделю.</small><Button size="large" variant="primary" icon={<Icon name="plus" size={15} />} onClick={openCreateGoal}>Добавить цель</Button></Card>
                  )}
                </section>
                <aside className="week-panel">
                  <div className="week-panel__head"><div><span className="micro-label">План недели</span><div className="week-title"><span>Неделя {selectedWeek}</span><span className="ss-button week-date" data-variant="tertiary" data-size="medium"><span className="ss-button__icon"><Icon name="calendar" size={12} /></span><span className="ss-button__label">{weekLabels[selectedWeek - 1]}</span></span></div></div></div>
                  <Card className="week-progress-card" tone="sunken">
                    <div className="week-progress-card__line"><span>{completedGoals} из {weekGoals.length} выполнено</span><strong>{weekProgress}%</strong></div>
                    <Meter value={weekProgress / 100} />
                  </Card>
                  {!weekGoals.length && !loading && <Card className="week-empty" pad="large"><strong>Здесь появятся карточки целей</strong><small>Для обычных целей — пункты, для повторяемых — выбранные дни.</small></Card>}
                  {orderedWeekGoals.map((goal) => {
                    const visibleOccurrences = goal.goal_occurrences.filter((occurrence) => occurrence.scheduled_date >= selectedWeekStart && occurrence.scheduled_date <= selectedWeekEnd)
                    const visibleUnits = goal.type === 'recurring' ? visibleOccurrences : goal.goal_items
                    const progress = goal.type === 'recurring' ? unitsProgress(visibleOccurrences) : goalProgress(goal)
                    const goalCompleted = isCompletedForSelectedWeek(goal)
                    const goalOverdue = Boolean(goal.end_date && goal.end_date < currentDateIso() && !goalCompleted)
                    const completedCount = visibleUnits.filter((unit) => unit.completed_at).length
                    const category = categoryLabels[goal.category ?? ''] ?? goal.category ?? 'Без категории'
                    const primary = isPrimaryGoal(goal)
                    const cardClass = `goal-card${goalOverdue ? ' goal-card--overdue' : ''}${primary ? ' goal-card--primary' : ''}`
                    const iconClass = `goal-card__icon${primary ? ' goal-card__icon--primary' : goalOverdue ? ' goal-card__icon--danger' : goalCompleted ? ' goal-card__icon--teal' : ''}`
                    if (goal.type === 'recurring') return (
                      <Card className={cardClass} pad="large" key={goal.id}>
                        <div className="goal-card__head">
                          <span className={iconClass}><Icon name="bolt" size={17} filled /></span>
                          <div><strong>{goal.title}</strong><small className={goalOverdue ? 'goal-card__overdue' : undefined}>{category} · {goalOverdue ? 'Просрочено · ' : ''}{completedCount} из {visibleOccurrences.length}</small></div>
                          <div className="goal-card__actions">
                            <PrimaryStar active={primary} title={goal.title} onClick={() => void togglePrimaryGoal(goal.id)} />
                            <Badge tone={goalOverdue ? 'danger' : goalCompleted ? 'success' : 'accent'}>{progress}%</Badge>
                            <Button variant="ghost" className="goal-card__edit" aria-label={`Редактировать цель ${goal.title}`} onClick={() => openGoalEditor(goal)}><Icon name="edit" size={15} /></Button>
                          </div>
                        </div>
                        <div className="goal-card__days">
                          {dayLabels.map((day, index) => {
                            const occurrence = visibleOccurrences.find((item) => dateFromIso(item.scheduled_date).getUTCDay() === ((index + 1) % 7))
                            return <Checkbox key={day} variant="tile" disabled={!occurrence} checked={Boolean(occurrence?.completed_at)} label={day} onChange={(checked) => occurrence && void updateOccurrence(occurrence, checked)} />
                          })}
                        </div>
                      </Card>
                    )
                    return (
                      <Card className={cardClass} pad="large" key={goal.id}>
                        <div className="goal-card__head">
                          <span className={iconClass}><Icon name={goal.type === 'structured' ? 'grip' : 'check'} size={17} /></span>
                          <div><strong>{goal.title}</strong><small className={goalOverdue ? 'goal-card__overdue' : undefined}>{category} · {goalOverdue ? 'Просрочено · ' : ''}{completedCount} из {goal.goal_items.length}</small></div>
                          <div className="goal-card__actions">
                            <PrimaryStar active={primary} title={goal.title} onClick={() => void togglePrimaryGoal(goal.id)} />
                            <Badge tone={goalOverdue ? 'danger' : goalCompleted ? 'success' : 'accent'}>{progress}%</Badge>
                            <Button variant="ghost" className="goal-card__edit" aria-label={`Редактировать цель ${goal.title}`} onClick={() => openGoalEditor(goal)}><Icon name="edit" size={15} /></Button>
                          </div>
                        </div>
                        <div className="goal-card__items">
                          {goal.goal_items.length ? itemsInListOrder(goal.goal_items).map((item) => (
                            <Checkbox
                              key={item.id}
                              checked={Boolean(item.completed_at)}
                              label={<span className="goal-item-label"><span>{item.title}</span>{item.scheduled_date && <time dateTime={item.scheduled_date}>{formatShortDate(item.scheduled_date)}</time>}</span>}
                              onChange={(checked) => void updateItem(item, checked)}
                            />
                          )) : <small className="goal-card__empty">У цели пока нет пунктов</small>}
                        </div>
                      </Card>
                    )
                  })}
                </aside>
              </div>
            </section>

            <Dialog open={dialogOpen} title={editingGoalId ? 'Редактировать цель' : 'Добавить цель на неделю'} subtitle={weekTitle} onClose={closeGoalDialog} footer={<>
              {editingGoalId && (
                <div className="goal-delete-control">
                  <Button size="large" variant="danger" icon={<Icon name="trash" size={14} />} onClick={() => setDeleteConfirmOpen((open) => !open)}>Удалить цель</Button>
                  <Popover show={deleteConfirmOpen} origin="bottom left" className="goal-delete-popover">
                    <strong>Удалить цель?</strong>
                    <small>Пункты, расписание и прогресс будут удалены без возможности восстановления.</small>
                    <div className="goal-delete-popover__actions">
                      <Button onClick={() => setDeleteConfirmOpen(false)}>Отмена</Button>
                      <Button variant="danger" onClick={() => void deleteGoal()}>{deletingGoal ? 'Удаляем…' : 'Удалить'}</Button>
                    </div>
                  </Popover>
                </div>
              )}
              <Button size="large" onClick={closeGoalDialog}>Отмена</Button>
              <Button size="large" variant="primary" onClick={() => void (editingGoalId ? updateGoal() : createGoal())}>{savingGoal ? 'Сохраняем…' : editingGoalId ? 'Сохранить' : 'Добавить цель'}</Button>
            </>}>
              <div className="goal-dialog-content"><section className="goal-dialog-main">
                <span className="form-label">{editingGoalId ? 'Тип цели нельзя изменить' : 'Выберите тип цели'}</span>
                <div className="goal-type-grid">
                  <GoalTypeCard active={goalType === 'checklist'} disabled={Boolean(editingGoalId)} title="Обычная цель" description="Результат и список шагов" icon="check" onClick={() => setGoalType('checklist')} />
                  <GoalTypeCard active={goalType === 'recurring'} disabled={Boolean(editingGoalId)} title="Повторяемая" description="Действие по выбранным дням" icon="clock" onClick={() => setGoalType('recurring')} />
                  <GoalTypeCard active={goalType === 'structured'} disabled={Boolean(editingGoalId)} title="С подзадачами" description="Этапы и вложенные пункты" icon="grip" onClick={() => setGoalType('structured')} />
                </div>
                <div className="goal-form-grid">
                  <Field label="Название" value={newGoalTitle} placeholder="Что нужно сделать?" editable focused onValueChange={setNewGoalTitle} />
                  <Select label="Категория" value={newGoalCategory} options={categoryOptions} onChange={setNewGoalCategory} />
                </div>
                <div className="goal-date-settings">
                  <Select label="Дата" value={goalDateMode} options={dateModeOptions} onChange={(value) => setGoalDateMode(value as 'all' | 'range')} />
                  {goalDateMode === 'range' && (
                    <div className="goal-date-range">
                      <DateField label="Начало" value={goalStartDate} min={cycleStart} max={dateWithOffset(cycleStart, 83)} onValueChange={(value) => {
                        setGoalStartDate(value)
                        const start = parseInputDate(value)
                        const end = parseInputDate(goalEndDate)
                        if (start && end && start > end) setGoalEndDate(value)
                      }} />
                      <DateField label="Окончание" value={goalEndDate} min={parseInputDate(goalStartDate) ?? cycleStart} max={dateWithOffset(cycleStart, 83)} onValueChange={(value) => {
                        const start = parseInputDate(goalStartDate)
                        const end = parseInputDate(value)
                        setGoalEndDate(start && end && end < start ? goalStartDate : value)
                      }} />
                    </div>
                  )}
                </div>
                {goalType === 'recurring' ? (
                  <div className="recurring-settings"><span className="form-label">Повторять</span><div className="dialog-days">{dayLabels.map((day, index) => <Checkbox key={day} variant="tile" checked={newGoalDays[index]} label={day} onChange={(checked) => setNewGoalDays((days) => days.map((value, dayIndex) => dayIndex === index ? checked : value))} />)}</div></div>
                ) : (
                  <Card tone="sunken" className="type-settings-card">
                    <div className="goal-items-editor">
                      {newGoalItems.map((item, index) => (
                        <div className="goal-item-editor" key={index} data-draggable={newGoalItems.length > 1 || undefined} data-dragging={draftDragIndex === index || undefined}>
                          {newGoalItems.length > 1 && (
                            <button type="button" className="goal-item-editor__handle" aria-label={`Переместить пункт ${index + 1}`} onPointerDown={(event) => startDraftDrag(index, event)}>
                              <Icon name="grip" size={14} />
                            </button>
                          )}
                          <Field
                            label={goalType === 'structured' ? `Этап или пункт ${index + 1}` : `Пункт ${index + 1}`}
                            value={item}
                            placeholder="Что нужно сделать?"
                            editable
                            onValueChange={(value) => setNewGoalItems((items) => items.map((current, itemIndex) => itemIndex === index ? value : current))}
                          />
                          <DatePicker
                            className={`goal-item-date${newGoalItemDates[index] ? ' goal-item-date--filled' : ''}`}
                            value={newGoalItemDates[index] ? dayjs(newGoalItemDates[index]) : null}
                            minDate={dayjs(goalDateMode === 'range' ? (parseInputDate(goalStartDate) ?? cycleStart) : cycleStart)}
                            maxDate={dayjs(goalDateMode === 'range' ? (parseInputDate(goalEndDate) ?? dateWithOffset(cycleStart, 83)) : dateWithOffset(cycleStart, 83))}
                            format="D MMM"
                            placeholder=""
                            allowClear
                            aria-label={`Дата пункта ${index + 1}`}
                            onChange={(date) => setNewGoalItemDates((dates) => dates.map((current, itemIndex) => itemIndex === index ? (date?.format('YYYY-MM-DD') ?? null) : current))}
                          />
                          {newGoalItems.length > 1 && (
                            <Button variant="ghost" className="goal-item-editor__remove" aria-label={`Удалить пункт ${index + 1}`} onClick={() => { setNewGoalItems((items) => items.filter((_, itemIndex) => itemIndex !== index)); setNewGoalItemDates((dates) => dates.filter((_, itemIndex) => itemIndex !== index)); setGoalItemIds((ids) => ids.filter((_, itemIndex) => itemIndex !== index)) }}>
                              <Icon name="close" size={14} />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button variant="secondary" icon={<Icon name="plus" size={14} />} onClick={() => { setNewGoalItems((items) => [...items, '']); setNewGoalItemDates((dates) => [...dates, null]); setGoalItemIds((ids) => [...ids, null]) }}>Добавить пункт</Button>
                    </div>
                  </Card>
                )}
                {goalFormError && <Badge tone="danger">{goalFormError}</Badge>}
              </section></div>
            </Dialog>

            <Dialog open={cycleSettingsOpen} className="cycle-settings-dialog" title="Дата первой недели" subtitle="Все даты 12 недель будут рассчитаны от этой даты" onClose={() => setCycleSettingsOpen(false)} footer={<><Button size="large" onClick={() => setCycleSettingsOpen(false)}>Отмена</Button><Button size="large" variant="primary" onClick={() => void saveCycleSettings()}>Сохранить</Button></>}>
              <div className="cycle-settings-form">
                <DateField label="Дата начала первой недели" value={cycleStartDraft} focused status={cycleDateError ? 'error' : undefined} onValueChange={(value) => { setCycleStartDraft(value); if (cycleDateError) setCycleDateError(false) }} />
                {cycleDateError && <Badge tone="danger">Введите корректную дату в формате ДД.ММ.ГГГГ</Badge>}
                {cycleSaveError && <Badge tone="danger">{cycleSaveError}</Badge>}
              </div>
            </Dialog>
          </div>
        )}
      </Stage>
    </main>
    </ConfigProvider>
  )
}
