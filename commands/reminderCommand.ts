import { Bell } from 'lucide-react'
import { ChatCommand } from '../types/chatCommands'
import { parseTimeExpression } from '../types/reminders'

export const reminderCommand: ChatCommand = {
  name: 'reminder',
  aliases: ['remind', 'r'],
  description: 'Set a reminder with native notifications',
  usage: '/reminder <time> <message>',
  category: 'utility',
  icon: Bell,
  arguments: [
    {
      name: 'time',
      description:
        'When to remind (5m, 2h, 1d, tomorrow, monday, 2:30pm, in 30 minutes)',
      required: true,
    },
    {
      name: 'message',
      description: 'What to be reminded about',
      required: true,
    },
  ],

  validate: (args) => {
    if (args.length < 2) {
      return {
        valid: false,
        error: `Please provide both time and message.

Usage: /reminder <time> <message>

Time formats:
  • Relative: 5m, 2h, 1d (minutes, hours, days)
  • Natural: tomorrow, monday, tonight, next week
  • Absolute: 2:30pm, 14:30, 9am
  • Descriptive: in 30 minutes, in 2 hours

Examples:
  /reminder 5m Check the oven
  /reminder tomorrow Call mom
  /reminder 2:30pm Team meeting
  /reminder monday Start project`,
      }
    }

    const timeStr = args[0]
    const dueAt = parseTimeExpression(timeStr)

    if (!dueAt) {
      return {
        valid: false,
        error: `Could not parse time: "${timeStr}"

Supported formats:
  • 5m, 2h, 1d (relative time)
  • tomorrow, monday, tonight, next week (natural language)
  • 2:30pm, 14:30, 9am (absolute time)
  • in 30 minutes, in 2 hours (descriptive)`,
      }
    }

    return { valid: true }
  },

  execute: async (args, context) => {
    const { createReminder } = await import('../api')
    const { formatReminderTime } = await import('../types/reminders')
    const { toast } = await import('sonner')

    const timeStr = args[0]
    const message = args.slice(1).join(' ')

    const dueAt = parseTimeExpression(timeStr)
    if (!dueAt) {
      return {
        success: false,
        message: `Could not parse time: "${timeStr}"`,
      }
    }

    await createReminder(message, dueAt, context.notebookName || undefined)

    const { useRemindersStore } = await import('../stores/remindersStore')
    useRemindersStore.getState().loadReminders()

    const timeDisplay = formatReminderTime(dueAt)

    toast.success('Reminder created', {
      description: `"${message}" - ${timeDisplay}`,
      duration: 4000,
    })

    return {
      success: true,
      clearInput: true,
    }
  },
}
