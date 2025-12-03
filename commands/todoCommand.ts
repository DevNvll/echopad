import { CheckSquare } from 'lucide-react'
import { ChatCommand } from '../types/chatCommands'

export const todoCommand: ChatCommand = {
  name: 'todo',
  aliases: ['task', 'checkbox'],
  description: 'Insert todo checkbox item',
  usage: '/todo <text>',
  category: 'note',
  icon: CheckSquare,
  arguments: [
    {
      name: 'text',
      description: 'Todo item text',
      required: false,
    },
  ],

  execute: async (args) => {
    if (args.length === 0) {
      return {
        success: true,
        insertContent: '- [ ] ',
        clearInput: false,
      }
    }

    const text = args.join(' ')

    return {
      success: true,
      insertContent: `- [ ] ${text}\n`,
      clearInput: false,
    }
  },
}
