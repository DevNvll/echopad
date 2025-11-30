import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { Note } from '../types'
import { formatMessageDate, shouldGroupMessages } from '../utils/formatting'
import { LinkPreview } from './LinkPreview'
import { NoteImage } from './NoteImage'
import { Search, Hash, Edit2, Copy, Trash2, Check } from 'lucide-react'
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

export const MessageList: React.FC = React.memo(function MessageList() {
  const { vaultPath } = useVaultStore()
  const { activeNotebook } = useNotebookStore()
  const {
    notes,
    isLoading,
    editingMessageId,
    targetMessageId,
    updateNote,
    deleteNote,
    setEditing
  } = useNotesStore()
  const { syncNoteTags, removeNoteTags } = useTagsStore()
  const { openCommand, openContextMenu, closeContextMenu } = useUIStore()

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
    closeContextMenu()
  }, [closeContextMenu])

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

  useEffect(() => {
    if (isLoading) return

    if (notes.length > prevNotesLengthRef.current) {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      })
    }
    prevNotesLengthRef.current = notes.length
  }, [notes.length, isLoading])

  useEffect(() => {
    if (isLoading) return

    if (targetMessageId) {
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
      <div className="flex-1 flex flex-col items-center justify-center text-textMuted gap-2">
        <div className="animate-spin w-5 h-5 border-2 border-brand border-t-transparent rounded-full"></div>
        <div className="text-sm font-medium tracking-wide">SYNCING</div>
      </div>
    )
  }

  if (notes.length === 0) {
    const notebookName = activeNotebook
      ? activeNotebook.split('/').pop()
      : 'notebook'

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 pb-32 select-none">
        <div className="flex flex-col items-center gap-6 max-w-md text-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-brand/20 via-brand/10 to-transparent border border-brand/20 flex items-center justify-center shadow-2xl shadow-brand/10">
              <Hash className="text-brand/80" size={36} strokeWidth={2.5} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-surface border border-brand/30 flex items-center justify-center">
              <span className="text-sm">✨</span>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-textMain tracking-tight">
              Welcome to <span className="text-brand">{notebookName}</span>
            </h3>
            <p className="text-sm text-textMuted/70 leading-relaxed">
              This notebook is ready for your thoughts, ideas, and notes.
              <br />
              Start typing below to create your first entry.
            </p>
          </div>

          <div className="flex flex-col gap-2 mt-2 text-[12px] text-textMuted/50">
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded font-mono text-[10px]">
                Enter
              </kbd>
              <span>to save a note</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded font-mono text-[10px]">
                #tag
              </kbd>
              <span>to organize with tags</span>
            </div>
          </div>
        </div>
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
            const isGrouped = shouldGroupMessages(
              note.createdAt,
              prevNote?.createdAt || null
            )
            const dateLabel = formatMessageDate(note.createdAt)
            const isEditing = editingMessageId === note.filename

            return (
              <div
                key={note.filename}
                id={`message-${note.filename}`}
                onContextMenu={(e) => {
                  e.preventDefault()
                  handleContextMenu(e, note)
                }}
                className={clsx(
                  'group relative transition-all duration-200',
                  isEditing
                    ? 'bg-amber-500/5 border-l-2 border-l-amber-500/60 pl-[78px] pr-8 py-4 mt-2 mb-2 rounded-r-lg'
                    : 'hover:bg-surface pl-[80px] pr-8 pt-1.5 pb-1.5',
                  !isEditing && (isGrouped ? 'mt-0' : 'mt-5')
                )}
              >
                {!isEditing && (
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
                  {!isGrouped && !isEditing && (
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
                        handleEditSubmit(note.filename, content)
                      }
                      onCancel={() => setEditing(null)}
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
                                handleTagClick(tag)
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

                      <div className="h-6 flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditing(note.filename)
                          }}
                          className="h-6 px-2 flex items-center gap-1.5 text-[11px] text-textMuted hover:text-textMain hover:bg-white/5 rounded transition-colors"
                        >
                          <Edit2 size={12} />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopy(note.content)
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
                                handleDelete(note.filename)
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
})
