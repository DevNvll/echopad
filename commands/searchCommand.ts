import { Search } from 'lucide-react'
import { ChatCommand } from '../types/chatCommands'

export const searchCommand: ChatCommand = {
  name: 'search',
  aliases: ['find', 's'],
  description: 'Search notes by query',
  usage: '/search <query>',
  category: 'search',
  icon: Search,
  arguments: [
    {
      name: 'query',
      description: 'Search query',
      required: true,
    },
  ],

  validate: (args) => {
    if (args.length === 0) {
      return {
        valid: false,
        error: 'Please provide a search query. Usage: /search <query>',
      }
    }
    return { valid: true }
  },

  execute: async (args) => {
    const { useRouterStore } = await import('../stores/routerStore')
    const query = args.join(' ')

    // Navigate to search view with query
    useRouterStore.getState().navigateToSearch(query)

    return {
      success: true,
      clearInput: true,
    }
  },
}
