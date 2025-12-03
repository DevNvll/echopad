import { CheckSquare } from 'lucide-react'
import { ChatCommand } from '../types/chatCommands'

export const todoCommand: ChatCommand = {
  name: 'todo',
  aliases: ['task', 'checkbox'],
  description: 'Insert todo checkbox items',
  usage: '/todo [item1] [item2] ...',
  category: 'note',
  icon: CheckSquare,
  arguments: [
    {
      name: 'items',
      description: 'Todo items to create',
      required: false,
    },
  ],

  execute: async (args) => {
    if (args.length === 0) {
      // Just insert an empty checkbox
      return {
        success: true,
        insertContent: '- [ ] ',
        clearInput: false,
      }
    }

    // Create multiple todo items
    const todos = args.map(item => `- [ ] ${item}`).join('\n')

    return {
      success: true,
      insertContent: todos + '\n',
      clearInput: false,
    }
  },
}
