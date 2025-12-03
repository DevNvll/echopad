import { Book } from 'lucide-react'
import { ChatCommand } from '../types/chatCommands'

export const notebookCommand: ChatCommand = {
  name: 'notebook',
  aliases: ['nb', 'switch'],
  description: 'Switch to a different notebook',
  usage: '/notebook <notebook-name>',
  category: 'notebook',
  icon: Book,
  arguments: [
    {
      name: 'notebook',
      description: 'Name of the notebook to switch to',
      required: true,
    },
  ],

  validate: (args) => {
    if (args.length === 0) {
      return {
        valid: false,
        error: 'Please provide a notebook name. Usage: /notebook <name>',
      }
    }
    return { valid: true }
  },

  execute: async (args) => {
    const { useNotebookStore } = await import('../stores/notebookStore')
    const notebookName = args.join(' ')
    const notebooks = useNotebookStore.getState().notebooks

    // Find matching notebook (case-insensitive)
    const matchingNotebook = notebooks.find(
      nb => nb.name.toLowerCase() === notebookName.toLowerCase()
    )

    if (!matchingNotebook) {
      // Find similar notebooks for suggestion
      const similar = notebooks.filter(nb =>
        nb.name.toLowerCase().includes(notebookName.toLowerCase())
      )

      let message = `Notebook "${notebookName}" not found.`
      if (similar.length > 0) {
        message += ` Did you mean: ${similar.map(nb => nb.name).join(', ')}?`
      }

      return {
        success: false,
        message,
      }
    }

    // Switch to the notebook
    useNotebookStore.getState().setActiveNotebook(matchingNotebook.name)

    return {
      success: true,
      message: `Switched to notebook: ${matchingNotebook.name}`,
      clearInput: true,
    }
  },

  autocomplete: async (partialArgs) => {
    if (partialArgs.length === 0) return []

    const { useNotebookStore } = await import('../stores/notebookStore')
    const notebooks = useNotebookStore.getState().notebooks

    const query = partialArgs.join(' ').toLowerCase()
    return notebooks
      .filter(nb => nb.name.toLowerCase().includes(query))
      .map(nb => nb.name)
      .slice(0, 5)
  },
}
