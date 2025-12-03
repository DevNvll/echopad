import React, { useEffect } from 'react'
import { Bell, Check, Trash2, Clock } from 'lucide-react'
import { useRemindersStore } from '../../stores/remindersStore'
import { formatReminderTime, getTimeUntil } from '../../types/reminders'
import { toast } from 'sonner'

export const UpcomingReminders: React.FC = () => {
  const { reminders, loading, loadReminders, completeReminder, deleteReminder } =
    useRemindersStore()

  useEffect(() => {
    // Load upcoming and overdue reminders
    loadReminders({ completed: false })
  }, [loadReminders])

  const upcomingReminders = reminders.filter(
    (r) => !r.completed && r.dueAt > Date.now()
  ).slice(0, 5)

  const overdueReminders = reminders.filter(
    (r) => !r.completed && r.dueAt <= Date.now()
  )

  const allDisplayReminders = [...overdueReminders, ...upcomingReminders].slice(0, 5)

  if (loading && reminders.length === 0) {
    return (
      <div className="bg-surface/50 border border-border/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Bell size={16} className="text-brand" />
          <h3 className="text-sm font-medium text-textMain">Upcoming Reminders</h3>
        </div>
        <div className="text-xs text-textMuted">Loading...</div>
      </div>
    )
  }

  if (allDisplayReminders.length === 0) {
    return (
      <div className="bg-surface/50 border border-border/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Bell size={16} className="text-brand" />
          <h3 className="text-sm font-medium text-textMain">Upcoming Reminders</h3>
        </div>
        <div className="text-xs text-textMuted italic">
          No upcoming reminders. Use <code className="bg-white/5 px-1 py-0.5 rounded">/reminder</code> to set one!
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface/50 border border-border/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-brand" />
          <h3 className="text-sm font-medium text-textMain">Upcoming Reminders</h3>
        </div>
        {overdueReminders.length > 0 && (
          <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
            {overdueReminders.length} overdue
          </span>
        )}
      </div>

      <div className="space-y-2">
        {allDisplayReminders.map((reminder) => {
          const isOverdue = reminder.dueAt <= Date.now()
          const timeDisplay = isOverdue ? 'Overdue' : getTimeUntil(reminder.dueAt)

          return (
            <div
              key={reminder.id}
              className={`group flex items-start gap-2 p-2 rounded-lg transition-colors ${
                isOverdue
                  ? 'bg-red-500/5 border border-red-500/20'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <Clock
                size={14}
                className={`mt-0.5 flex-shrink-0 ${
                  isOverdue ? 'text-red-400' : 'text-textMuted'
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-textMain line-clamp-2">
                  {reminder.message}
                </div>
                <div
                  className={`text-xs mt-1 ${
                    isOverdue ? 'text-red-400 font-medium' : 'text-textMuted'
                  }`}
                >
                  {formatReminderTime(reminder.dueAt)}
                  {!isOverdue && (
                    <span className="ml-1.5 opacity-60">· {timeDisplay}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    completeReminder(reminder.id)
                    toast.success('Reminder completed', {
                      description: reminder.message,
                      duration: 3000,
                    })
                  }}
                  className="p-1 hover:bg-green-500/20 text-green-400 rounded transition-colors"
                  title="Complete"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => {
                    deleteReminder(reminder.id)
                    toast.success('Reminder deleted', {
                      description: reminder.message,
                      duration: 3000,
                    })
                  }}
                  className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {reminders.filter((r) => !r.completed).length > 5 && (
        <div className="mt-3 text-xs text-textMuted text-center">
          +{reminders.filter((r) => !r.completed).length - 5} more reminders
        </div>
      )}
    </div>
  )
}
