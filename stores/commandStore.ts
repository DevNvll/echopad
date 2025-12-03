import { create } from 'zustand'
import {
  ChatCommand,
  CommandCategory,
  CommandContext,
  CommandExecutionError,
  CommandRegistry,
  CommandResult,
} from '../types/chatCommands'

interface CommandState extends CommandRegistry {
  commands: Map<string, ChatCommand>
  commandHistory: Array<{ command: string; timestamp: number; success: boolean }>
  maxHistorySize: number
  addToHistory: (command: string, success: boolean) => void
  clearHistory: () => void
  getRecentCommands: (limit?: number) => string[]
}

const parseCommandString = (commandString: string): { name: string; args: string[] } => {
  const cleaned = commandString.trim().replace(/^\//, '')
  const parts: string[] = []
  let current = ''
  let inQuotes = false
  let quoteChar = ''

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i]

    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true
      quoteChar = char
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false
      quoteChar = ''
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        parts.push(current)
        current = ''
      }
    } else {
      current += char
    }
  }

  if (current) {
    parts.push(current)
  }

  const [name, ...args] = parts
  return { name: name || '', args }
}

export const useCommandStore = create<CommandState>((set, get) => ({
  commands: new Map(),
  commandHistory: [],
  maxHistorySize: 50,

  getAllCommands: () => {
    return Array.from(get().commands.values()).filter(cmd => cmd.enabled !== false)
  },

  getCommand: (nameOrAlias: string) => {
    const commands = get().commands
    const lowerName = nameOrAlias.toLowerCase()

    const exactMatch = commands.get(lowerName)
    if (exactMatch) {
      return exactMatch
    }

    for (const command of commands.values()) {
      if (command.aliases?.some(alias => alias.toLowerCase() === lowerName)) {
        return command
      }
    }

    return undefined
  },

  registerCommand: (command: ChatCommand) => {
    set((state) => {
      const newCommands = new Map(state.commands)
      newCommands.set(command.name.toLowerCase(), command)
      return { commands: newCommands }
    })
  },

  unregisterCommand: (name: string) => {
    set((state) => {
      const newCommands = new Map(state.commands)
      newCommands.delete(name.toLowerCase())
      return { commands: newCommands }
    })
  },

  getCommandsByCategory: (category: CommandCategory) => {
    return get()
      .getAllCommands()
      .filter(cmd => cmd.category === category)
  },

  executeCommand: async (commandString: string, context: CommandContext): Promise<CommandResult> => {
    const { name, args } = parseCommandString(commandString)

    if (!name) {
      return {
        success: false,
        message: 'No command specified',
      }
    }

    const command = get().getCommand(name)

    if (!command) {
      return {
        success: false,
        message: `Unknown command: /${name}. Type /help to see available commands.`,
      }
    }

    if (command.validate) {
      const validation = command.validate(args, context)
      if (!validation.valid) {
        return {
          success: false,
          message: validation.error || 'Invalid command arguments',
        }
      }
    }

    try {
      const result = await command.execute(args, context)
      get().addToHistory(commandString, result.success)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      get().addToHistory(commandString, false)

      throw new CommandExecutionError(
        `Failed to execute /${name}: ${errorMessage}`,
        name,
        args
      )
    }
  },

  addToHistory: (command: string, success: boolean) => {
    set((state) => {
      const newHistory = [
        { command, timestamp: Date.now(), success },
        ...state.commandHistory,
      ].slice(0, state.maxHistorySize)

      return { commandHistory: newHistory }
    })
  },

  clearHistory: () => {
    set({ commandHistory: [] })
  },

  getRecentCommands: (limit = 10) => {
    return get()
      .commandHistory
      .slice(0, limit)
      .map(h => h.command)
  },
}))
