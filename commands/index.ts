import { ChatCommand } from '../types/chatCommands'
import { helpCommand } from './helpCommand'
import { tagCommand } from './tagCommand'
import { notebookCommand } from './notebookCommand'
import { searchCommand } from './searchCommand'
import { timestampCommand } from './timestampCommand'
import { todoCommand } from './todoCommand'
import { templateCommand } from './templateCommand'
import { pingCommand } from './pingCommand'
import { reminderCommand } from './reminderCommand'

export const builtInCommands: ChatCommand[] = [
  pingCommand,
  helpCommand,
  tagCommand,
  notebookCommand,
  searchCommand,
  timestampCommand,
  todoCommand,
  templateCommand,
  reminderCommand,
]

export const registerBuiltInCommands = async () => {
  const { useCommandStore } = await import('../stores/commandStore')

  for (const command of builtInCommands) {
    useCommandStore.getState().registerCommand(command)
  }
}

export const createCommand = (command: ChatCommand): ChatCommand => {
  return command
}

export {
  pingCommand,
  helpCommand,
  tagCommand,
  notebookCommand,
  searchCommand,
  timestampCommand,
  todoCommand,
  templateCommand,
  reminderCommand,
}
