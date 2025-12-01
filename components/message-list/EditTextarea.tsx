import React, { useEffect, useRef, useState } from 'react'

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
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = e.target.scrollHeight + 'px'
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className="w-full bg-black/30 border border-brand/20 rounded-lg p-3 text-[15px] text-textMain focus:outline-none focus:border-brand/40 resize-none overflow-hidden font-sans leading-relaxed transition-colors"
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
            <button
              onClick={onCancel}
              className="h-6 px-2 text-[11px] text-textMuted hover:text-textMain rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => content.trim() && onSubmit(content)}
              disabled={!content.trim() || !hasChanges}
              className="h-6 px-2.5 text-[11px] font-medium text-background bg-brand hover:bg-brand/90 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    )
  }
)

EditTextarea.displayName = 'EditTextarea'


