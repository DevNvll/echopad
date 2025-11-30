import React from 'react'
import { Loader2 } from 'lucide-react'

export const LoadingState: React.FC = React.memo(() => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-textMuted/50 gap-3">
      <Loader2 size={18} className="animate-spin text-brand/60" />
      <div className="text-[11px] font-medium tracking-widest uppercase">
        Loading
      </div>
    </div>
  )
})

LoadingState.displayName = 'LoadingState'

export const LoadingMoreIndicator: React.FC = React.memo(() => {
  return (
    <div className="flex justify-center py-3 mb-2">
      <div className="flex items-center gap-2 text-[11px] text-textMuted/50">
        <Loader2 size={12} className="animate-spin" />
        <span>Loading more...</span>
      </div>
    </div>
  )
})

LoadingMoreIndicator.displayName = 'LoadingMoreIndicator'


