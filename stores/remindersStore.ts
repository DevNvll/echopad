import { create } from 'zustand'
import { Reminder, ReminderFilter } from '../types/reminders'
import {
  createReminder as apiCreateReminder,
  listReminders as apiListReminders,
  completeReminder as apiCompleteReminder,
  deleteReminder as apiDeleteReminder,
  getDueReminders as apiGetDueReminders,
  markReminderNotified as apiMarkReminderNotified,
} from '../api'
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'
import { toast } from 'sonner'

interface RemindersState {
  reminders: Reminder[]
  loading: boolean
  checkInterval: NodeJS.Timeout | null
  loadReminders: (filter?: ReminderFilter) => Promise<void>
  createReminder: (message: string, dueAt: number, notebookPath?: string) => Promise<Reminder>
  completeReminder: (id: string) => Promise<void>
  deleteReminder: (id: string) => Promise<void>
  startBackgroundCheck: () => void
  stopBackgroundCheck: () => void
  checkDueReminders: () => Promise<void>
}

export const useRemindersStore = create<RemindersState>((set, get) => ({
  reminders: [],
  loading: false,
  checkInterval: null,

  loadReminders: async (filter?: ReminderFilter) => {
    set({ loading: true })
    try {
      const reminders = await apiListReminders(filter)
      set({ reminders })
    } catch (error) {
      console.error('Failed to load reminders:', error)
    } finally {
      set({ loading: false })
    }
  },

  createReminder: async (message: string, dueAt: number, notebookPath?: string) => {
    const reminder = await apiCreateReminder(message, dueAt, notebookPath)
    set((state) => ({
      reminders: [...state.reminders, reminder].sort((a, b) => a.dueAt - b.dueAt),
    }))
    return reminder
  },

  completeReminder: async (id: string) => {
    await apiCompleteReminder(id)
    set((state) => ({
      reminders: state.reminders.map((r) =>
        r.id === id ? { ...r, completed: true } : r
      ),
    }))
  },

  deleteReminder: async (id: string) => {
    await apiDeleteReminder(id)
    set((state) => ({
      reminders: state.reminders.filter((r) => r.id !== id),
    }))
  },

  startBackgroundCheck: () => {
    get().stopBackgroundCheck()
    get().checkDueReminders()

    const interval = setInterval(() => {
      get().checkDueReminders()
    }, 30 * 1000)

    set({ checkInterval: interval })
  },

  stopBackgroundCheck: () => {
    const { checkInterval } = get()
    if (checkInterval) {
      clearInterval(checkInterval)
      set({ checkInterval: null })
    }
  },

  checkDueReminders: async () => {
    try {
      const dueReminders = await apiGetDueReminders()

      if (dueReminders.length === 0) {
        return
      }

      let permissionGranted = await isPermissionGranted()

      if (!permissionGranted) {
        const permission = await requestPermission()
        permissionGranted = permission === 'granted'
      }

      if (!permissionGranted) {
        console.warn('Notification permission not granted')
        return
      }

      for (const reminder of dueReminders) {
        try {
          await sendNotification({
            title: 'Reminder',
            body: reminder.message,
            icon: 'icon.png',
          })

          toast('Reminder', {
            description: reminder.message,
            duration: 10000,
            action: {
              label: 'Complete',
              onClick: () => {
                get().completeReminder(reminder.id)
              },
            },
          })

          await apiMarkReminderNotified(reminder.id)

          set((state) => ({
            reminders: state.reminders.map((r) =>
              r.id === reminder.id ? { ...r, notified: true } : r
            ),
          }))

        } catch (error) {
          console.error('Failed to send notification:', error)
        }
      }
    } catch (error) {
      console.error('Failed to check due reminders:', error)
    }
  },
}))

if (typeof window !== 'undefined') {
  setTimeout(() => {
    useRemindersStore.getState().startBackgroundCheck()
  }, 2000)
}
