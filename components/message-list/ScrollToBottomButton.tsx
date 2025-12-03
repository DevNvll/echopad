import React from 'react'
import { ChevronDown } from 'lucide-react'

interface ScrollToBottomButtonProps {
  onClick: () => void
}

export const ScrollToBottomButton: React.FC<ScrollToBottomButtonProps> =
  React.memo(({ onClick }) => {
    return (
      <button
        onClick={onClick}
        className="absolute bottom-32 right-6 z-10 flex items-center justify-center w-8 h-8 bg-surface/90 backdrop-blur-sm border border-border/40 rounded-full shadow-lg transition-all hover:bg-surfaceHighlight"
        title="Scroll to bottom"
      >
        <ChevronDown size={16} className="text-textMuted/70" />
      </button>
    )
  })

ScrollToBottomButton.displayName = 'ScrollToBottomButton'




