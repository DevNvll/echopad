import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface EditTextareaProps {
  initialContent: string
  onSubmit: (content: string) => void
  onCancel: () => void
}

export const EditTextarea: React.FC<EditTextareaProps> = React.memo(
  ({ initialContent, onSubmit, onCancel }) => {
    const [content, setContent] = useState(initialContent)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const hasChanges = content !== initialContent

    useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height =
          textareaRef.current.scrollHeight + 'px'
        textareaRef.current.setSelectionRange(
          textareaRef.current.value.length,
          textareaRef.current.value.length
        )
      }
    }, [])

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (content.trim()) {
          onSubmit(content)
        }
      } else if (e.key === 'Escape') {
        onCancel()
      }
    }

    return (
      <div className="w-full animate-in fade-in duration-150">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = e.target.scrollHeight + 'px'
          }}
          onKeyDown={handleKeyDown}
          className="min-h-0 bg-black/30 border-brand/20 p-3 text-[15px] text-textMain focus-visible:border-brand/40 focus-visible:ring-0 resize-none overflow-hidden font-sans leading-relaxed"
          rows={1}
        />
        <div className="flex items-center justify-between mt-2.5">
          <div className="flex items-center gap-2.5 text-[10px] text-textMuted/50">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-px bg-white/5 rounded text-[9px] font-mono">
                esc
              </kbd>
              <span>cancel</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-px bg-white/5 rounded text-[9px] font-mono">
                ↵
              </kbd>
              <span>save</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-6 px-2 text-[11px] text-textMuted hover:text-textMain"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => content.trim() && onSubmit(content)}
              disabled={!content.trim() || !hasChanges}
              className="h-6 px-2.5 text-[11px]"
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    )
  }
)

EditTextarea.displayName = 'EditTextarea'


