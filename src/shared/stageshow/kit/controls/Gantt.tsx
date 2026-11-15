import { useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Icon } from '../parts/Icon'
import { StarMark } from '../parts/StarMark'
import './Gantt.css'

export type GanttTone = 'accent' | 'teal' | 'violet' | 'amber' | 'rose'

export type GanttRow = {
  id: string
  title: string
  startWeek: number
  endWeek: number
  tone?: GanttTone
  primary?: boolean
  progress?: number
  progressSegments?: { startWeek: number; endWeek: number }[]
  segments?: { startWeek: number; endWeek: number }[]
  marks?: number[]
}

export type GanttColumn = {
  id: string
  label: string
  meta?: string
  isToday?: boolean
}

export interface GanttProps {
  rows: GanttRow[]
  selectedWeek: number
  onWeekSelect?: (week: number) => void
  onRowSelect?: (row: GanttRow) => void
  onTogglePrimary?: (row: GanttRow) => void
  onReorder?: (from: number, to: number) => void
  weeks?: number
  columns?: GanttColumn[]
  cornerLabel?: string
}

function clampGanttDrop(rows: GanttRow[], from: number, to: number) {
  const primaryCount = rows.filter((row) => row.primary).length
  if (rows[from]?.primary) return Math.max(0, Math.min(to, Math.max(primaryCount - 1, 0)))
  return Math.max(primaryCount, Math.min(to, rows.length - 1))
}

function reorderRows(rows: GanttRow[], from: number, to: number) {
  const next = [...rows]
  const [row] = next.splice(from, 1)
  next.splice(to, 0, row)
  return next
}

export function Gantt({ rows, selectedWeek, onWeekSelect, onRowSelect, onTogglePrimary, onReorder, weeks = 12, columns, cornerLabel = 'Цели / задачи' }: GanttProps) {
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null)
  const columnItems: GanttColumn[] = columns ?? Array.from({ length: weeks }, (_, index) => ({ id: String(index + 1), label: `Н${index + 1}` }))
  const columnCount = columnItems.length
  const shownRows = drag ? reorderRows(rows, drag.from, drag.to) : rows

  const startDrag = (index: number, event: ReactPointerEvent<HTMLElement>) => {
    if (!onReorder || event.button !== 0) return
    if ((event.target as HTMLElement).closest('.ss-gantt__star')) return
    if ((event.target as HTMLElement).closest('.ss-gantt__grip')) event.preventDefault()
    const rowHeight = event.currentTarget.closest('.ss-gantt')?.querySelector('.ss-gantt__label')?.getBoundingClientRect().height ?? 94
    const startY = event.clientY
    let to = index
    let moved = false
    const move = (pointer: PointerEvent) => {
      const next = clampGanttDrop(rows, index, index + Math.round((pointer.clientY - startY) / rowHeight))
      if (next !== index) moved = true
      if (next !== to) {
        to = next
        setDrag({ from: index, to })
      }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDrag(null)
      if (!moved) return
      const stopClick = (click: MouseEvent) => {
        click.preventDefault()
        click.stopPropagation()
        window.removeEventListener('click', stopClick, true)
      }
      window.addEventListener('click', stopClick, true)
      if (to !== index) onReorder(index, to)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div className="ss-gantt" style={{ '--ss-gantt-weeks': columnCount, '--ss-gantt-rows': Math.max(rows.length, 1) } as CSSProperties}>
      <div className="ss-gantt__corner">{cornerLabel}</div>
      <div className="ss-gantt__weeks">
        {columnItems.map((column, index) => (
          <button key={column.id} type="button" className="ss-gantt__week" data-selected={index + 1 === selectedWeek || undefined} onClick={() => onWeekSelect?.(index + 1)}>
            {column.isToday && <span className="ss-gantt__week-dot" aria-hidden="true" />}
            <span className="ss-gantt__week-label">{column.label}</span>
            {column.meta && <span className="ss-gantt__week-meta">{column.meta}</span>}
          </button>
        ))}
      </div>
      <div className="ss-gantt__labels">
        {shownRows.map((row) => (
          <div key={row.id} className="ss-gantt__label" data-primary={row.primary || undefined} data-dragging={drag?.from !== undefined && rows[drag.from]?.id === row.id || undefined}>
            {onReorder && (
              <button
                type="button"
                className="ss-gantt__grip"
                aria-label={`Переместить цель ${row.title}`}
                title={row.primary ? 'Важные задачи остаются выше обычных' : 'Переместить'}
                onPointerDown={(event) => startDrag(rows.findIndex((candidate) => candidate.id === row.id), event)}
              >
                <Icon name="grip" size={14} />
              </button>
            )}
            {onTogglePrimary && (
              <button
                type="button"
                className="ss-gantt__star"
                data-active={row.primary || undefined}
                aria-pressed={Boolean(row.primary)}
                aria-label={row.primary ? `Снять главную задачу: ${row.title}` : `Сделать главной задачей: ${row.title}`}
                title={row.primary ? 'Главная задача' : 'Сделать главной'}
                onClick={() => onTogglePrimary(row)}
              >
                <StarMark active={Boolean(row.primary)} size={16} />
              </button>
            )}
            <button type="button" className="ss-gantt__label-title" onClick={() => onRowSelect?.(row)}>{row.title}</button>
          </div>
        ))}
      </div>
      <div className="ss-gantt__timeline">
        <span className="ss-gantt__selection" style={{ left: `${((selectedWeek - 1) / columnCount) * 100}%`, width: `${100 / columnCount}%` }} />
        {shownRows.flatMap((row, index) => {
          const segments = row.segments ?? [{ startWeek: row.startWeek, endWeek: row.endWeek }]
          return segments.map((segment, segmentIndex) => (
          <button
            key={`${row.id}-${segmentIndex}`}
            type="button"
            className="ss-gantt__bar"
            data-tone={row.tone ?? 'accent'}
            data-primary={row.primary || undefined}
            data-dragging={drag && rows[drag.from]?.id === row.id || undefined}
            data-segmented={row.progressSegments ? true : undefined}
            title={row.title}
            style={{
              top: `calc(${index} * var(--ss-gantt-row) + var(--ss-gantt-bar-offset, 14px))`,
              left: `calc(${((segment.startWeek - 1) / columnCount) * 100}% + 5px)`,
              width: `calc(${((segment.endWeek - segment.startWeek + 1) / columnCount) * 100}% - 10px)`,
              '--ss-gantt-progress': `${Math.min(100, Math.max(0, row.progress ?? 0))}%`,
            } as CSSProperties}
            onPointerDown={(event) => onReorder && startDrag(rows.findIndex((candidate) => candidate.id === row.id), event)}
            onClick={() => onRowSelect?.({ ...row, startWeek: segment.startWeek, endWeek: segment.endWeek })}
          >
            {row.progressSegments?.map((progressSegment, progressSegmentIndex) => {
              const rowLength = row.endWeek - row.startWeek + 1
              return (
                <span
                  key={`${progressSegment.startWeek}-${progressSegment.endWeek}-${progressSegmentIndex}`}
                  className="ss-gantt__bar-progress"
                  style={{
                    left: `${((progressSegment.startWeek - row.startWeek) / rowLength) * 100}%`,
                    width: `${((progressSegment.endWeek - progressSegment.startWeek + 1) / rowLength) * 100}%`,
                  }}
                  aria-hidden="true"
                />
              )
            })}
            <span className="ss-gantt__bar-label">{row.title}</span>
          </button>
          ))
        })}
        {shownRows.flatMap((row, index) => (row.marks ?? []).map((day) => (
          <span
            key={`${row.id}-mark-${day}`}
            className="ss-gantt__mark"
            style={{
              top: `calc(${index} * var(--ss-gantt-row) + var(--ss-gantt-bar-offset, 14px) + var(--ss-gantt-bar-height, 46px) / 2)`,
              left: `calc(${((day - 0.5) / columnCount) * 100}%)`,
            }}
            aria-hidden="true"
          />
        )))}
      </div>
    </div>
  )
}
