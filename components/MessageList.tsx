import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { Note } from '../types'
import { formatMessageDate, shouldGroupMessages } from '../utils/formatting'
import { LinkPreview } from './LinkPreview'
import { NoteImage } from './NoteImage'
import { Search, Hash, Edit2, Copy, Trash2, Check } from 'lucide-react'
import { clsx } from 'clsx'

const EditTextarea: React.FC<{
  initialContent: string
  onSubmit: (content: string) => void
  onCancel: () => void
}> = React.memo(({ initialContent, onSubmit, onCancel }) => {
  const [content, setContent] = useState(initialContent)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hasChanges = content !== initialContent

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
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
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
          <Edit2 size={11} />
          <span>Editing message</span>
        </div>
        {hasChanges && (
          <span className="text-[10px] text-textMuted/60 italic">
            (unsaved changes)
          </span>
        )}
      </div>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => {
          setContent(e.target.value)
          e.target.style.height = 'auto'
          e.target.style.height = e.target.scrollHeight + 'px'
        }}
        onKeyDown={handleKeyDown}
        className="w-full bg-black/40 border border-amber-500/20 rounded-lg p-3 text-[15px] text-textMain focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 resize-none overflow-hidden font-sans leading-relaxed transition-all shadow-inner"
        rows={1}
      />
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3 text-[11px] text-textMuted/70">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-mono">
              Esc
            </kbd>
            <span className="ml-1">cancel</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-mono">
              Enter
            </kbd>
            <span className="ml-1">save</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="h-7 px-3 text-[12px] font-medium text-textMuted hover:text-textMain bg-white/5 hover:bg-white/10 rounded-md transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => content.trim() && onSubmit(content)}
            disabled={!content.trim() || !hasChanges}
            className="h-7 px-3 text-[12px] font-medium text-black bg-amber-500 hover:bg-amber-400 rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Check size={12} />
            Save
          </button>
        </div>
      </div>
    </div>
  )
})

interface MessageListProps {
  notes: Note[]
  isLoading?: boolean
  isSearching?: boolean
  notebooks?: Record<string, string>
  onNoteClick?: (note: Note) => void
  targetMessageId?: string | null
  onContextMenu?: (e: React.MouseEvent, note: Note) => void
  editingMessageId?: string | null
  onEditSubmit?: (filename: string, newContent: string) => void
  onEditCancel?: () => void
  vaultPath?: string | null
  onTagClick?: (tag: string) => void
  onEditStart?: (filename: string) => void
  onCopy?: (content: string) => void
  onDelete?: (filename: string) => void
  onScroll?: () => void
}

export const MessageList: React.FC<MessageListProps> = React.memo(
  function MessageList({
    notes,
    isLoading,
    isSearching,
    notebooks,
    onNoteClick,
    targetMessageId,
    onContextMenu,
    editingMessageId,
    onEditSubmit,
    onEditCancel,
    vaultPath,
    onTagClick,
    onEditStart,
    onCopy,
    onDelete,
    onScroll
  }) {
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
    const bottomRef = useRef<HTMLDivElement>(null)
    const prevNotesLengthRef = useRef(notes.length)
    const deleteConfirmIdRef = useRef(deleteConfirmId)
    deleteConfirmIdRef.current = deleteConfirmId

    const handleScroll = useCallback(() => {
      if (deleteConfirmIdRef.current) {
        setDeleteConfirmId(null)
      }
      onScroll?.()
    }, [onScroll])

    useEffect(() => {
      if (isLoading || isSearching) return

      if (notes.length > prevNotesLengthRef.current) {
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        })
      }
      prevNotesLengthRef.current = notes.length
    }, [notes.length, isLoading, isSearching])

    useEffect(() => {
      if (isLoading) return

      if (targetMessageId && !isSearching) {
        const timer = setTimeout(() => {
          const element = document.getElementById(`message-${targetMessageId}`)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            element.classList.add('bg-brand/10', 'ring-1', 'ring-brand/20')
            setTimeout(() => {
              element.classList.remove('bg-brand/10', 'ring-1', 'ring-brand/20')
            }, 2500)
          }
        }, 150)
        return () => clearTimeout(timer)
      }
    }, [isSearching, targetMessageId, isLoading])

    const markdownComponents = useMemo(
      () => ({
        h1: ({ node, ...props }: any) => (
          <h1
            {...props}
            className="text-2xl font-bold text-textMain mt-4 mb-2 pb-1 border-b border-border/50"
          />
        ),
        h2: ({ node, ...props }: any) => (
          <h2
            {...props}
            className="text-xl font-bold text-textMain mt-3 mb-2"
          />
        ),
        h3: ({ node, ...props }: any) => (
          <h3
            {...props}
            className="text-lg font-bold text-textMain mt-3 mb-1"
          />
        ),
        h4: ({ node, ...props }: any) => (
          <h4
            {...props}
            className="text-base font-bold text-textMain mt-2 mb-1"
          />
        ),
        strong: ({ node, ...props }: any) => (
          <strong {...props} className="font-semibold text-textMain" />
        ),
        em: ({ node, ...props }: any) => (
          <em {...props} className="italic text-textMain/90" />
        ),
        blockquote: ({ node, ...props }: any) => (
          <blockquote
            {...props}
            className="border-l-[3px] border-brand/40 pl-4 py-1 my-2 text-textMuted italic bg-surfaceHighlight/5 rounded-r"
          />
        ),
        code: ({ node, className, ...props }: any) => (
          <code
            {...props}
            className={clsx(
              'bg-surfaceHighlight border border-border/50 rounded px-1.5 py-px text-[85%] font-mono text-accent',
              className
            )}
          />
        ),
        pre: ({ node, ...props }: any) => (
          <pre
            {...props}
            className="bg-black/40 border border-border/50 rounded-lg p-4 my-3 overflow-x-auto text-sm font-mono text-textMuted/90 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
          />
        ),
        ul: ({ node, ...props }: any) => (
          <ul
            {...props}
            className="list-disc list-outside ml-5 mb-2 space-y-1 text-textMuted marker:text-brand/50"
          />
        ),
        ol: ({ node, ...props }: any) => (
          <ol
            {...props}
            className="list-decimal list-outside ml-5 mb-2 space-y-1 text-textMuted marker:text-brand/50"
          />
        ),
        a: ({ node, ...props }: any) => (
          <a
            {...props}
            className="text-brand hover:underline hover:text-accentHover transition-colors cursor-pointer"
            target="_blank"
            rel="noreferrer"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          />
        ),
        p: ({ node, ...props }: any) => (
          <p {...props} className="mb-1 last:mb-0" />
        ),
        img: ({ node, src, alt, ...props }: any) => {
          if (
            src &&
            vaultPath &&
            !src.startsWith('http://') &&
            !src.startsWith('https://') &&
            !src.startsWith('data:')
          ) {
            return <NoteImage src={src} alt={alt} vaultPath={vaultPath} />
          }
          return (
            <img
              src={src}
              alt={alt || ''}
              className="max-w-full h-auto rounded-lg my-2"
              {...props}
            />
          )
        }
      }),
      [vaultPath]
    )

    if (isLoading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-textMuted gap-2">
          <div className="animate-spin w-5 h-5 border-2 border-brand border-t-transparent rounded-full"></div>
          <div className="text-sm font-medium tracking-wide">SYNCING</div>
        </div>
      )
    }

    if (notes.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-textMuted/50 gap-4 p-8 pb-28 text-center select-none">
          {isSearching ? (
            <>
              <div className="w-14 h-14 bg-surfaceHighlight rounded-2xl flex items-center justify-center border border-border">
                <Search size={24} className="text-textMuted" />
              </div>
              <div>
                <h3 className="text-textMain font-medium text-base mb-1">
                  No results found
                </h3>
                <p className="text-sm">Try different keywords or operators.</p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-3xl bg-linear-to-tr from-surfaceHighlight to-transparent border border-white/5 flex items-center justify-center mb-2 shadow-lg">
                <span className="text-4xl">✨</span>
              </div>
              <p className="text-base font-medium text-textMuted">
                This is the beginning of this notebook.
              </p>
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="flex-1 relative flex flex-col min-h-0">
        <div
          className="flex-1 overflow-y-auto custom-scrollbar py-2 flex flex-col"
          onScroll={handleScroll}
        >
          <div className="grow" />
          <div className="w-full max-w-4xl mx-auto pb-28">
            {notes.map((note, index) => {
              const prevNote = index > 0 ? notes[index - 1] : null
              const isGrouped =
                !isSearching &&
                shouldGroupMessages(note.createdAt, prevNote?.createdAt || null)
              const dateLabel = formatMessageDate(note.createdAt)
              const notebookName = notebooks
                ? notebooks[note.notebookName]
                : null
              const isEditing = editingMessageId === note.filename

              return (
                <div
                  key={note.filename}
                  id={`message-${note.filename}`}
                  onClick={() => isSearching && onNoteClick?.(note)}
                  onContextMenu={(e) => {
                    if (!isSearching && onContextMenu) {
                      e.preventDefault()
                      onContextMenu(e, note)
                    }
                  }}
                  className={clsx(
                    'group relative transition-all duration-200',
                    isSearching
                      ? 'mx-3 mt-4 pb-4 border-b border-border/30 last:border-0 cursor-pointer hover:bg-surfaceHighlight/40 hover:border-border/60 rounded-xl px-4'
                      : isEditing
                      ? 'bg-amber-500/5 border-l-2 border-l-amber-500/60 pl-[78px] pr-8 py-4 mt-2 mb-2 rounded-r-lg'
                      : 'hover:bg-surface pl-[80px] pr-8 pt-1.5 pb-1.5',
                    !isSearching && !isEditing && (isGrouped ? 'mt-0' : 'mt-5')
                  )}
                >
                  {isSearching && notebookName && (
                    <div className="flex items-center gap-2 mb-2 opacity-60">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-textMuted uppercase tracking-wider bg-surfaceHighlight/50 px-2 py-0.5 rounded">
                        <Hash size={11} />
                        {notebookName}
                      </div>
                      <span className="text-[11px] text-textMuted">
                        {dateLabel}
                      </span>
                    </div>
                  )}

                  {!isSearching && !isEditing && (
                    <div className="absolute left-0 top-0 w-[80px] flex justify-end pr-5 select-none">
                      {!isGrouped ? (
                        <span className="text-[11px] font-bold text-textMuted/60 uppercase tracking-wide mt-[7px]">
                          {new Date(note.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })}
                        </span>
                      ) : (
                        <span className="hidden group-hover:inline text-[10px] text-textMuted/30 font-mono mt-2 tabular-nums">
                          {new Date(note.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    {!isSearching && !isGrouped && !isEditing && (
                      <div className="mb-1 flex items-baseline gap-2">
                        <span className="text-[12px] font-bold text-brand/80 tracking-wide">
                          {dateLabel}
                        </span>
                      </div>
                    )}
                    {isEditing && (
                      <div className="mb-2 text-[11px] text-textMuted/50">
                        Created {dateLabel} at{' '}
                        {new Date(note.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false
                        })}
                      </div>
                    )}

                    {isEditing ? (
                      <EditTextarea
                        initialContent={note.content}
                        onSubmit={(content) =>
                          onEditSubmit?.(note.filename, content)
                        }
                        onCancel={() => onEditCancel?.()}
                      />
                    ) : (
                      <div className="text-textMain/95 text-[15px] leading-relaxed markdown-content font-sans tracking-normal">
                        <ReactMarkdown components={markdownComponents}>
                          {note.content}
                        </ReactMarkdown>

                        {note.tags && note.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2.5 opacity-80 hover:opacity-100 transition-opacity">
                            {note.tags.map((tag) => (
                              <span
                                key={tag}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onTagClick?.(tag)
                                }}
                                className="text-[11px] bg-brand/5 text-brand border border-brand/10 px-2 py-0.5 rounded hover:bg-brand/10 cursor-pointer transition-colors select-none font-medium"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {note.urls &&
                          note.urls.map((url, i) => (
                            <div key={i} onClick={(e) => e.stopPropagation()}>
                              <LinkPreview url={url} />
                            </div>
                          ))}

                        {!isSearching && (
                          <div className="h-6 flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onEditStart?.(note.filename)
                              }}
                              className="h-6 px-2 flex items-center gap-1.5 text-[11px] text-textMuted hover:text-textMain hover:bg-white/5 rounded transition-colors"
                            >
                              <Edit2 size={12} />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onCopy?.(note.content)
                                setCopiedMessageId(note.filename)
                                setTimeout(() => setCopiedMessageId(null), 1500)
                              }}
                              className={clsx(
                                'h-6 px-2 flex items-center gap-1.5 text-[11px] rounded transition-colors',
                                copiedMessageId === note.filename
                                  ? 'text-green-400 bg-green-400/10'
                                  : 'text-textMuted hover:text-textMain hover:bg-white/5'
                              )}
                            >
                              {copiedMessageId === note.filename ? (
                                <>
                                  <Check size={12} />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                            {deleteConfirmId === note.filename ? (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onDelete?.(note.filename)
                                    setDeleteConfirmId(null)
                                  }}
                                  className="h-6 px-2 flex items-center gap-1.5 text-[11px] text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded transition-colors"
                                >
                                  <Trash2 size={12} />
                                  <span>Confirm</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDeleteConfirmId(null)
                                  }}
                                  className="h-6 px-2 flex items-center text-[11px] text-textMuted hover:text-textMain hover:bg-white/5 rounded transition-colors"
                                >
                                  <span>Cancel</span>
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteConfirmId(note.filename)
                                }}
                                className="h-6 px-2 flex items-center gap-1.5 text-[11px] text-red-400/70 hover:text-red-400 hover:bg-red-400/5 rounded transition-colors"
                              >
                                <Trash2 size={12} />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} className="h-px" />
          </div>
        </div>
      </div>
    )
  }
)
