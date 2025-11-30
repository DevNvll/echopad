import React, { forwardRef } from 'react'

interface DateSeparatorProps {
  label: string
}

export const DateSeparator = React.memo(
  forwardRef<HTMLDivElement, DateSeparatorProps>(({ label }, ref) => {
    return (
      <div ref={ref} className="flex items-center gap-3 pt-6 pb-2 first:pt-0">
        <div className="h-px flex-1 bg-border/30" />
        <span className="text-[10px] font-medium text-textMuted/40 uppercase tracking-wider">
          {label}
        </span>
        <div className="h-px flex-1 bg-border/30" />
      </div>
    )
  })
)

DateSeparator.displayName = 'DateSeparator'
