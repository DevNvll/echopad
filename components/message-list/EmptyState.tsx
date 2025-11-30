import React from 'react'
import { Hash } from 'lucide-react'

interface EmptyStateProps {
  notebookName: string
}

export const EmptyState: React.FC<EmptyStateProps> = React.memo(
  ({ notebookName }) => {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 pb-32 select-none">
        <div className="flex flex-col items-center gap-5 max-w-sm text-center">
          <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/10 flex items-center justify-center">
            <Hash className="text-brand/70" size={22} strokeWidth={2} />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base font-medium text-textMain">
              {notebookName}
            </h3>
            <p className="text-[13px] text-textMuted/60 leading-relaxed">
              Start typing below to add your first note
            </p>
          </div>
        </div>
      </div>
    )
  }
)

EmptyState.displayName = 'EmptyState'


