import { HelpCircle } from 'lucide-react'
import { ChatCommand } from '../types/chatCommands'

export const helpCommand: ChatCommand = {
  name: 'help',
  aliases: ['h', '?'],
  description: 'Show available commands or help for a specific command',
  usage: '/help [command-name]',
  category: 'utility',
  icon: HelpCircle,
  arguments: [
    {
      name: 'command',
      description: 'Specific command to get help for',
      required: false,
    },
  ],

  execute: async (args, context) => {
    const { useCommandStore } = await import('../stores/commandStore')
    const commandName = args[0]

    if (commandName) {
      // Show help for specific command
      const command = useCommandStore.getState().getCommand(commandName)

      if (!command) {
        return {
          success: false,
          message: `Command /${commandName} not found`,
        }
      }

      let helpText = `# /${command.name}\n\n${command.description}\n\n`

      if (command.usage) {
        helpText += `**Usage:** ${command.usage}\n\n`
      }

      if (command.aliases && command.aliases.length > 0) {
        helpText += `**Aliases:** ${command.aliases.map(a => `/${a}`).join(', ')}\n\n`
      }

      if (command.arguments && command.arguments.length > 0) {
        helpText += `**Arguments:**\n`
        for (const arg of command.arguments) {
          const required = arg.required ? '(required)' : '(optional)'
          helpText += `- **${arg.name}** ${required}: ${arg.description}\n`
        }
      }

      return {
        success: true,
        createNote: true,
        noteContent: helpText,
        clearInput: true,
      }
    }

    // Show all commands grouped by category
    const allCommands = useCommandStore.getState().getAllCommands()
    const categories = new Map<string, ChatCommand[]>()

    for (const cmd of allCommands) {
      const categoryCommands = categories.get(cmd.category) || []
      categoryCommands.push(cmd)
      categories.set(cmd.category, categoryCommands)
    }

    let helpText = '# Available Commands\n\n'

    for (const [category, commands] of Array.from(categories.entries()).sort()) {
      helpText += `## ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`

      for (const cmd of commands.sort((a, b) => a.name.localeCompare(b.name))) {
        const aliases = cmd.aliases?.length ? ` (${cmd.aliases.map(a => `/${a}`).join(', ')})` : ''
        helpText += `- **/${cmd.name}**${aliases}: ${cmd.description}\n`
      }

      helpText += '\n'
    }

    helpText += '\nType `/help [command-name]` for detailed help on a specific command.'

    return {
      success: true,
      createNote: true,
      noteContent: helpText,
      clearInput: true,
    }
  },
}
