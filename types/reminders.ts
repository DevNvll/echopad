export interface Reminder {
  id: string
  message: string
  dueAt: number
  createdAt: number
  notebookPath?: string
  completed: boolean
  notified: boolean
}

export interface CreateReminderInput {
  message: string
  dueAt: number
  notebookPath?: string
}

export interface ReminderFilter {
  completed?: boolean
  upcoming?: boolean
  overdue?: boolean
}

export function parseRelativeTime(timeStr: string): number | null {
  const match = timeStr.match(/^(\d+)([smhd])$/)
  if (!match) return null

  const value = parseInt(match[1])
  const unit = match[2]

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  }

  return value * multipliers[unit]
}

export function parseAbsoluteTime(timeStr: string): number | null {
  const now = new Date()

  const time24Match = timeStr.match(/^(\d{1,2}):(\d{2})$/)
  if (time24Match) {
    const hours = parseInt(time24Match[1])
    const minutes = parseInt(time24Match[2])

    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      const target = new Date(now)
      target.setHours(hours, minutes, 0, 0)

      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1)
      }

      return target.getTime()
    }
  }

  const time12Match = timeStr.toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s?(am|pm)$/)
  if (time12Match) {
    let hours = parseInt(time12Match[1])
    const minutes = time12Match[2] ? parseInt(time12Match[2]) : 0
    const meridiem = time12Match[3]

    if (meridiem === 'pm' && hours !== 12) {
      hours += 12
    } else if (meridiem === 'am' && hours === 12) {
      hours = 0
    }

    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      const target = new Date(now)
      target.setHours(hours, minutes, 0, 0)

      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1)
      }

      return target.getTime()
    }
  }

  return null
}

export function parseNaturalDate(dateStr: string): number | null {
  const now = new Date()
  const lower = dateStr.toLowerCase().trim()

  if (lower === 'today') {
    const target = new Date(now)
    target.setHours(now.getHours() + 1, 0, 0, 0)
    return target.getTime()
  }

  if (lower === 'tomorrow') {
    const target = new Date(now)
    target.setDate(now.getDate() + 1)
    target.setHours(9, 0, 0, 0)
    return target.getTime()
  }

  if (lower === 'tonight') {
    const target = new Date(now)
    target.setHours(20, 0, 0, 0)
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1)
    }
    return target.getTime()
  }

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayIndex = days.indexOf(lower)
  if (dayIndex !== -1) {
    const target = new Date(now)
    const currentDay = now.getDay()
    let daysToAdd = dayIndex - currentDay

    if (daysToAdd <= 0) {
      daysToAdd += 7
    }

    target.setDate(now.getDate() + daysToAdd)
    target.setHours(9, 0, 0, 0)
    return target.getTime()
  }

  if (lower === 'next week') {
    const target = new Date(now)
    target.setDate(now.getDate() + 7)
    target.setHours(9, 0, 0, 0)
    return target.getTime()
  }

  if (lower === 'next month') {
    const target = new Date(now)
    target.setMonth(now.getMonth() + 1)
    target.setHours(9, 0, 0, 0)
    return target.getTime()
  }

  const inMatch = lower.match(/^in\s+(\d+)\s+(second|minute|hour|day|week)s?$/)
  if (inMatch) {
    const value = parseInt(inMatch[1])
    const unit = inMatch[2]

    const multipliers: Record<string, number> = {
      second: 1000,
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
    }

    return Date.now() + value * multipliers[unit]
  }

  return null
}

export function parseTimeExpression(timeStr: string): number | null {
  const relative = parseRelativeTime(timeStr)
  if (relative !== null) {
    return Date.now() + relative
  }

  const natural = parseNaturalDate(timeStr)
  if (natural !== null) {
    return natural
  }

  return parseAbsoluteTime(timeStr)
}

export function formatReminderTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()

  const isToday = date.toDateString() === now.toDateString()
  const isTomorrow =
    date.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString()

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  if (isToday) {
    return `Today at ${timeStr}`
  } else if (isTomorrow) {
    return `Tomorrow at ${timeStr}`
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }
}

export function getTimeUntil(timestamp: number): string {
  const diff = timestamp - Date.now()

  if (diff < 0) {
    return 'Overdue'
  }

  const minutes = Math.floor(diff / (60 * 1000))
  const hours = Math.floor(diff / (60 * 60 * 1000))
  const days = Math.floor(diff / (24 * 60 * 60 * 1000))

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}`
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`
  } else if (minutes > 0) {
    return `${minutes} min${minutes > 1 ? 's' : ''}`
  } else {
    return 'Less than 1 min'
  }
}
