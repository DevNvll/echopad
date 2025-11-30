import { BookOpen, FileText, Hash } from 'lucide-react'

interface StatsBarProps {
  notebooksCount: number
  notesCount: number
  tagsCount: number
}

export function StatsBar({ notebooksCount, notesCount, tagsCount }: StatsBarProps) {
  const stats = [
    {
      label: 'Notebooks',
      value: notebooksCount,
      icon: BookOpen,
      color: 'from-violet-500/20 to-violet-600/10 border-violet-500/30',
      iconColor: 'text-violet-400'
    },
    {
      label: 'Notes',
      value: notesCount,
      icon: FileText,
      color: 'from-sky-500/20 to-sky-600/10 border-sky-500/30',
      iconColor: 'text-sky-400'
    },
    {
      label: 'Tags',
      value: tagsCount,
      icon: Hash,
      color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
      iconColor: 'text-emerald-400'
    }
  ]

  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${stat.color} border p-4`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-textMain tabular-nums">
                {stat.value}
              </p>
              <p className="text-xs text-textMuted/70 mt-0.5">{stat.label}</p>
            </div>
            <stat.icon className={`${stat.iconColor} opacity-60`} size={28} strokeWidth={1.5} />
          </div>
        </div>
      ))}
    </div>
  )
}

