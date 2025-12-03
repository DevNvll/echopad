import { Clock } from 'lucide-react'
import { ChatCommand } from '../types/chatCommands'
import { format } from 'date-fns'

export const timestampCommand: ChatCommand = {
  name: 'timestamp',
  aliases: ['time', 'now', 'ts'],
  description: 'Insert current timestamp',
  usage: '/timestamp [format]',
  category: 'utility',
  icon: Clock,
  arguments: [
    {
      name: 'format',
      description: 'Date format (iso, short, long, time)',
      required: false,
      defaultValue: 'short',
    },
  ],

  execute: async (args) => {
    const formatType = args[0]?.toLowerCase() || 'short'
    const now = new Date()

    let timestamp: string

    switch (formatType) {
      case 'iso':
        timestamp = now.toISOString()
        break
      case 'long':
        timestamp = format(now, 'EEEE, MMMM d, yyyy h:mm a')
        break
      case 'time':
        timestamp = format(now, 'h:mm a')
        break
      case 'date':
        timestamp = format(now, 'yyyy-MM-dd')
        break
      case 'short':
      default:
        timestamp = format(now, 'yyyy-MM-dd h:mm a')
        break
    }

    return {
      success: true,
      insertContent: timestamp + ' ',
      clearInput: false,
    }
  },

  autocomplete: async () => {
    return ['iso', 'short', 'long', 'time', 'date']
  },
}
