import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { Note } from '../types'
import { formatMessageDate, shouldGroupMessages } from '../utils/formatting'
import { LinkPreview } from './LinkPreview'
import { NoteImage } from './NoteImage'
import {
  Hash,
  Pencil,
  Copy,
  Trash2,
  Check,
  ChevronDown,
  Loader2,
  X
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  useVaultStore,
  useNotebookStore,
  useNotesStore,
  useTagsStore,
  useUIStore
} from '../stores'

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
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => {
          setContent(e.target.value)
          e.target.style.height = 'auto'
          e.target.style.height = e.target.scrollHeight + 'px'
        }}
        onKeyDown={handleKeyDown}
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
})

export const MessageList: React.FC = React.memo(function MessageList() {
  const { vaultPath } = useVaultStore()
  const { activeNotebook } = useNotebookStore()
  const {
    notes,
    isLoading,
    isLoadingMore,
    hasMore,
    editingMessageId,
    targetMessageId,
    updateNote,
    deleteNote,
    setEditing,
    loadMoreNotes
  } = useNotesStore()
  const { syncNoteTags, removeNoteTags } = useTagsStore()
  const { openCommand, openContextMenu, closeContextMenu } = useUIStore()

  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const deleteConfirmIdRef = useRef(deleteConfirmId)
  deleteConfirmIdRef.current = deleteConfirmId

  const handleScroll = useCallback(() => {
    if (deleteConfirmIdRef.current) {
      setDeleteConfirmId(null)
    }
    closeContextMenu()

    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        scrollContainerRef.current
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight
      setShowScrollToBottom(distanceFromBottom > 200)

      // Infinite scroll: load more when near the top
      if (
        scrollTop < 100 &&
        hasMore &&
        !isLoadingMore &&
        vaultPath &&
        activeNotebook
      ) {
        const prevScrollHeight = scrollHeight
        loadMoreNotes(vaultPath, activeNotebook).then(() => {
          // Restore scroll position after loading
          requestAnimationFrame(() => {
            if (scrollContainerRef.current) {
              const newScrollHeight = scrollContainerRef.current.scrollHeight
              scrollContainerRef.current.scrollTop =
                newScrollHeight - prevScrollHeight + scrollTop
            }
          })
        })
      }
    }
  }, [
    closeContextMenu,
    hasMore,
    isLoadingMore,
    vaultPath,
    activeNotebook,
    loadMoreNotes
  ])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [])

  const handleEditSubmit = useCallback(
    async (filename: string, newContent: string) => {
      if (!vaultPath || !activeNotebook) return
      const updated = await updateNote(
        vaultPath,
        activeNotebook,
        filename,
        newContent
      )
      await syncNoteTags(updated)
    },
    [vaultPath, activeNotebook, updateNote, syncNoteTags]
  )

  const handleDelete = useCallback(
    async (filename: string) => {
      if (!vaultPath || !activeNotebook) return
      await removeNoteTags(filename, activeNotebook)
      await deleteNote(vaultPath, activeNotebook, filename)
    },
    [vaultPath, activeNotebook, removeNoteTags, deleteNote]
  )

  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content)
  }, [])

  const handleTagClick = useCallback(
    (tag: string) => {
      openCommand(`#${tag}`)
    },
    [openCommand]
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, note: Note) => {
      openContextMenu({
        x: e.clientX,
        y: e.clientY,
        type: 'message',
        data: note
      })
    },
    [openContextMenu]
  )

  // Track the last note to detect new notes (vs loading older ones)
  const lastNoteRef = useRef<string | null>(null)
  const hasInitialScrolled = useRef(false)

  // Reset scroll tracking when notebook changes
  useEffect(() => {
    lastNoteRef.current = null
    hasInitialScrolled.current = false
  }, [activeNotebook])

  useEffect(() => {
    if (isLoading || notes.length === 0) return

    const currentLastNote = notes[notes.length - 1]?.filename

    // Scroll to bottom on initial load OR when a new note is added at the END
    const isInitialLoad = !hasInitialScrolled.current
    const isNewNoteAdded =
      lastNoteRef.current !== null && currentLastNote !== lastNoteRef.current

    if (isInitialLoad || isNewNoteAdded) {
      hasInitialScrolled.current = true
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'auto' })
      })
    }

    lastNoteRef.current = currentLastNote
  }, [notes, isLoading])

  useEffect(() => {
    if (isLoading) return

    if (targetMessageId) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`message-${targetMessageId}`)
        if (element) {
          element.scrollIntoView({ behavior: 'auto', block: 'center' })
          element.classList.add('bg-brand/10', 'ring-1', 'ring-brand/20')
          setTimeout(() => {
            element.classList.remove('bg-brand/10', 'ring-1', 'ring-brand/20')
          }, 2500)
        }
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [targetMessageId, isLoading])

  const markdownComponents = useMemo(
    () => ({
      h1: ({ node, ...props }: any) => (
        <h1
          {...props}
          className="text-2xl font-bold text-textMain mt-4 mb-2 pb-1 border-b border-border/50"
        />
      ),
      h2: ({ node, ...props }: any) => (
        <h2 {...props} className="text-xl font-bold text-textMain mt-3 mb-2" />
      ),
      h3: ({ node, ...props }: any) => (
        <h3 {...props} className="text-lg font-bold text-textMain mt-3 mb-1" />
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
      <div className="flex-1 flex flex-col items-center justify-center text-textMuted/50 gap-3">
        <Loader2 size={18} className="animate-spin text-brand/60" />
        <div className="text-[11px] font-medium tracking-widest uppercase">
          Loading
        </div>
      </div>
    )
  }

  if (notes.length === 0) {
    const notebookName = activeNotebook
      ? activeNotebook.split('/').pop()
      : 'notebook'

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

  return (
    <div className="flex-1 relative flex flex-col min-h-0">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar py-4 flex flex-col"
        onScroll={handleScroll}
      >
        <div className="grow" />
        <div className="w-full max-w-3xl mx-auto pb-28 px-6">
          {/* Loading indicator for infinite scroll */}
          {isLoadingMore && (
            <div className="flex justify-center py-3 mb-2">
              <div className="flex items-center gap-2 text-[11px] text-textMuted/50">
                <Loader2 size={12} className="animate-spin" />
                <span>Loading more...</span>
              </div>
            </div>
          )}
          {notes.map((note, index) => {
            const prevNote = index > 0 ? notes[index - 1] : null
            const isGrouped = shouldGroupMessages(
              note.createdAt,
              prevNote?.createdAt || null
            )
            const dateLabel = formatMessageDate(note.createdAt)
            const isEditing = editingMessageId === note.filename

            return (
              <div key={note.filename}>
                {/* Date separator */}
                {!isGrouped && !isEditing && (
                  <div className="flex items-center gap-3 pt-6 pb-2 first:pt-0">
                    <div className="h-px flex-1 bg-border/30" />
                    <span className="text-[10px] font-medium text-textMuted/40 uppercase tracking-wider">
                      {dateLabel}
                    </span>
                    <div className="h-px flex-1 bg-border/30" />
                  </div>
                )}

                <div
                  id={`message-${note.filename}`}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    handleContextMenu(e, note)
                  }}
                  className={clsx(
                    'group relative transition-colors duration-150',
                    isEditing
                      ? 'bg-brand/5 rounded-lg px-4 py-4 my-2'
                      : 'hover:bg-white/2 rounded-lg px-4 py-2.5',
                    isGrouped && !isEditing && 'mt-0'
                  )}
                >
                  <div className="flex gap-3">
                    {/* Time column */}
                    {!isEditing && (
                      <div className="w-10 shrink-0 pt-0.5">
                        <span
                          className={clsx(
                            'text-[10px] tabular-nums transition-opacity',
                            isGrouped
                              ? 'text-textMuted/20 opacity-0 group-hover:opacity-100'
                              : 'text-textMuted/40'
                          )}
                        >
                          {new Date(note.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })}
                        </span>
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <EditTextarea
                          initialContent={note.content}
                          onSubmit={(content) =>
                            handleEditSubmit(note.filename, content)
                          }
                          onCancel={() => setEditing(null)}
                        />
                      ) : (
                        <>
                          <div className="text-textMain/90 text-[14px] leading-relaxed markdown-content">
                            <ReactMarkdown components={markdownComponents}>
                              {note.content}
                            </ReactMarkdown>
                          </div>

                          {note.tags && note.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {note.tags.map((tag) => (
                                <span
                                  key={tag}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleTagClick(tag)
                                  }}
                                  className="text-[10px] text-brand/70 hover:text-brand cursor-pointer transition-colors select-none"
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

                          {/* Action buttons */}
                          <div className="flex items-center gap-0.5 mt-1 -ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditing(note.filename)
                              }}
                              className="h-6 w-6 flex items-center justify-center text-textMuted/50 hover:text-textMain rounded transition-colors"
                              title="Edit"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopy(note.content)
                                setCopiedMessageId(note.filename)
                                setTimeout(() => setCopiedMessageId(null), 1500)
                              }}
                              className={clsx(
                                'h-6 w-6 flex items-center justify-center rounded transition-colors',
                                copiedMessageId === note.filename
                                  ? 'text-green-400'
                                  : 'text-textMuted/50 hover:text-textMain'
                              )}
                              title="Copy"
                            >
                              {copiedMessageId === note.filename ? (
                                <Check size={12} />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                            {deleteConfirmId === note.filename ? (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDelete(note.filename)
                                    setDeleteConfirmId(null)
                                  }}
                                  className="h-6 px-2 flex items-center gap-1 text-[10px] font-medium text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded transition-colors"
                                >
                                  <Trash2 size={10} />
                                  <span>Delete</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDeleteConfirmId(null)
                                  }}
                                  className="h-6 w-6 flex items-center justify-center text-textMuted/50 hover:text-textMain rounded transition-colors"
                                  title="Cancel"
                                >
                                  <X size={12} />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteConfirmId(note.filename)
                                }}
                                className="h-6 w-6 flex items-center justify-center text-textMuted/50 hover:text-red-400 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} className="h-px" />
        </div>
      </div>

      {/* Scroll to Bottom Button */}
      {showScrollToBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-32 right-6 z-10 flex items-center justify-center w-8 h-8 bg-surface/90 backdrop-blur-sm border border-border/40 rounded-full shadow-lg transition-all hover:bg-surfaceHighlight"
          title="Scroll to bottom"
        >
          <ChevronDown size={16} className="text-textMuted/70" />
        </button>
      )}
    </div>
  )
})
