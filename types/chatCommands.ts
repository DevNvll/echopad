import { LucideIcon } from 'lucide-react'

export interface CommandContext {
  notebookName: string | null
  vaultPath: string | null
  searchQuery?: string
  activeTags?: string[]
}

export interface CommandResult {
  success: boolean
  message?: string
  insertContent?: string
  clearInput?: boolean
  createNote?: boolean
  noteContent?: string
}

export interface CommandArgument {
  name: string
  description: string
  required: boolean
  defaultValue?: string
  pattern?: RegExp
}

export interface ChatCommand {
  name: string
  aliases?: string[]
  description: string
  usage?: string
  category: CommandCategory
  icon?: LucideIcon
  arguments?: CommandArgument[]
  enabled?: boolean
  execute: (args: string[], context: CommandContext) => Promise<CommandResult>
  validate?: (args: string[], context: CommandContext) => { valid: boolean; error?: string }
  autocomplete?: (partialArgs: string[], context: CommandContext) => Promise<string[]>
}

export type CommandCategory =
  | 'note'
  | 'notebook'
  | 'search'
  | 'tag'
  | 'sync'
  | 'utility'
  | 'custom'

export class CommandExecutionError extends Error {
  constructor(
    message: string,
    public commandName: string,
    public args: string[]
  ) {
    super(message)
    this.name = 'CommandExecutionError'
  }
}

export interface CommandRegistry {
  getAllCommands: () => ChatCommand[]
  getCommand: (nameOrAlias: string) => ChatCommand | undefined
  registerCommand: (command: ChatCommand) => void
  unregisterCommand: (name: string) => void
  getCommandsByCategory: (category: CommandCategory) => ChatCommand[]
  executeCommand: (commandString: string, context: CommandContext) => Promise<CommandResult>
}
