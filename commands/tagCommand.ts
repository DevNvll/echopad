import { Tag } from 'lucide-react'
import { ChatCommand } from '../types/chatCommands'

export const tagCommand: ChatCommand = {
  name: 'tag',
  aliases: ['t'],
  description: 'Add tags to your note',
  usage: '/tag <tag1> [tag2] [tag3] ...',
  category: 'tag',
  icon: Tag,
  arguments: [
    {
      name: 'tags',
      description: 'One or more tags to add (without #)',
      required: true,
    },
  ],

  validate: (args) => {
    if (args.length === 0) {
      return {
        valid: false,
        error: 'Please provide at least one tag. Usage: /tag <tag1> [tag2] ...',
      }
    }
    return { valid: true }
  },

  execute: async (args) => {
    // Format tags with # prefix
    const tags = args.map(tag => {
      const cleaned = tag.replace(/^#/, '').trim()
      return `#${cleaned}`
    })

    return {
      success: true,
      insertContent: tags.join(' ') + ' ',
      clearInput: false,
      message: `Added ${tags.length} tag(s)`,
    }
  },

  autocomplete: async (partialArgs, context) => {
    if (partialArgs.length === 0) return []

    const { useTagsStore } = await import('../stores/tagsStore')
    const allTags = useTagsStore.getState().tags

    const lastArg = partialArgs[partialArgs.length - 1].toLowerCase()
    return allTags
      .filter(tag => tag.toLowerCase().includes(lastArg))
      .map(tag => tag.replace(/^#/, ''))
      .slice(0, 5)
  },
}
