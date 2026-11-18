import { invoke, isTauri } from '@tauri-apps/api/core'

type CalendarEvent = { id: string; title: string; date: string }

function escapeTitle(title: string) {
  const printableTitle = Array.from(title).filter((character) => {
    const code = character.charCodeAt(0)
    return character === '\t' || character === '\n' || character === '\r' || (code >= 32 && code !== 127)
  }).join('')
  return printableTitle
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/[,;]/g, '\\$&')
}

function foldLine(line: string) {
  const encoder = new TextEncoder()
  let result = ''
  let bytes = 0
  for (const character of line) {
    const length = encoder.encode(character).length
    if (bytes + length > 75) {
      result += '\r\n '
      bytes = 1
    }
    result += character
    bytes += length
  }
  return result
}

export async function addToCalendar(events: CalendarEvent[]) {
  if (events.length === 0) return
  const timestamp = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '')
  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//12 Weeks//Tracker//RU',
    ...events.flatMap(({ id, title, date }) => [
      'BEGIN:VEVENT',
      `UID:${encodeURIComponent(id)}@12week-tracker`,
      `DTSTAMP:${timestamp}`,
      `DTSTART;VALUE=DATE:${date.replaceAll('-', '')}`,
      `SUMMARY:${escapeTitle(title)}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
    '',
  ].map(foldLine).join('\r\n')

  if (isTauri()) {
    await invoke('open_calendar_event', { calendar, eventId: events[0].id })
    return
  }

  const url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = '12-weeks.ics'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
