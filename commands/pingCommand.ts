import { Zap } from 'lucide-react'
import { ChatCommand } from '../types/chatCommands'

export const pingCommand: ChatCommand = {
  name: 'ping',
  aliases: ['test'],
  description: 'Test if commands are working',
  usage: '/ping',
  category: 'utility',
  icon: Zap,

  execute: async () => {
    return {
      success: true,
      insertContent: 'Pong! Commands are working. ',
      message: 'Commands are working!',
    }
  },
}
