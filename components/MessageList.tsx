import React, { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Note } from '../types'
import { formatMessageDate, shouldGroupMessages } from '../utils/formatting'
import { LinkPreview } from './LinkPreview'
import { NoteImage } from './NoteImage'
import { Search, Hash } from 'lucide-react'
import { clsx } from 'clsx'

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
    onTagClick
  }) {
    const [editContent, setEditContent] = useState('')
    const editAreaRef = useRef<HTMLTextAreaElement>(null)
    const bottomRef = useRef<HTMLDivElement>(null)
    const prevNotesLengthRef = useRef(notes.length)

    useEffect(() => {
      if (isLoading || isSearching) return

      if (notes.length > prevNotesLengthRef.current) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
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

    useEffect(() => {
      if (editingMessageId) {
        const note = notes.find((n) => n.filename === editingMessageId)
        if (note) {
          setEditContent(note.content)
          setTimeout(() => {
            if (editAreaRef.current) {
              editAreaRef.current.focus()
              editAreaRef.current.style.height = 'auto'
              editAreaRef.current.style.height =
                editAreaRef.current.scrollHeight + 'px'
            }
          }, 0)
        }
      }
    }, [editingMessageId, notes])

    const handleEditKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (editingMessageId && editContent.trim()) {
          onEditSubmit?.(editingMessageId, editContent)
        }
      } else if (e.key === 'Escape') {
        onEditCancel?.()
      }
    }

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
        <div className="flex-1 flex flex-col items-center justify-center text-textMuted/50 gap-4 p-8 text-center select-none">
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
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-surfaceHighlight to-transparent border border-white/5 flex items-center justify-center mb-2 shadow-lg">
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
        <div className="flex-1 overflow-y-auto custom-scrollbar py-2 flex flex-col">
          <div className="flex-grow" />
          {notes.map((note, index) => {
            const prevNote = index > 0 ? notes[index - 1] : null
            const isGrouped =
              !isSearching &&
              shouldGroupMessages(note.createdAt, prevNote?.createdAt || null)
            const dateLabel = formatMessageDate(note.createdAt)
            const notebookName = notebooks ? notebooks[note.notebookName] : null
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
                  'group relative transition-colors duration-100',
                  isSearching
                    ? 'mx-3 mt-4 pb-4 border-b border-border/30 last:border-0 cursor-pointer hover:bg-surfaceHighlight/40 hover:border-border/60 rounded-xl px-4'
                    : isEditing
                    ? 'bg-surfaceHighlight/30 pl-[80px] pr-8 py-3 mt-1'
                    : 'hover:bg-[#0a0a0a] pl-[80px] pr-8',
                  !isSearching &&
                    !isEditing &&
                    (isGrouped ? 'mt-1 py-0.5' : 'mt-6 py-0.5')
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

                {!isSearching && (
                  <div className="absolute left-0 top-0 w-[80px] flex justify-end pr-5 select-none">
                    {!isGrouped || isEditing ? (
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

                  {isEditing ? (
                    <div className="w-full">
                      <textarea
                        ref={editAreaRef}
                        value={editContent}
                        onChange={(e) => {
                          setEditContent(e.target.value)
                          e.target.style.height = 'auto'
                          e.target.style.height = e.target.scrollHeight + 'px'
                        }}
                        onKeyDown={handleEditKeyDown}
                        className="w-full bg-surfaceHighlight border border-border/60 rounded-md p-3 text-[15px] text-textMain focus:outline-none focus:border-brand/50 resize-none overflow-hidden font-sans leading-relaxed"
                        rows={1}
                      />
                      <div className="text-[11px] text-textMuted mt-2 flex gap-2">
                        <span>
                          escape to{' '}
                          <span
                            onClick={onEditCancel}
                            className="text-brand hover:underline cursor-pointer"
                          >
                            cancel
                          </span>
                        </span>
                        <span>•</span>
                        <span>
                          enter to{' '}
                          <span
                            onClick={() =>
                              editingMessageId &&
                              onEditSubmit?.(editingMessageId, editContent)
                            }
                            className="text-brand hover:underline cursor-pointer"
                          >
                            save
                          </span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-textMain/95 text-[15px] leading-relaxed markdown-content font-sans tracking-normal">
                      <ReactMarkdown
                        components={{
                          h1: ({ node, ...props }) => (
                            <h1
                              {...props}
                              className="text-2xl font-bold text-textMain mt-4 mb-2 pb-1 border-b border-border/50"
                            />
                          ),
                          h2: ({ node, ...props }) => (
                            <h2
                              {...props}
                              className="text-xl font-bold text-textMain mt-3 mb-2"
                            />
                          ),
                          h3: ({ node, ...props }) => (
                            <h3
                              {...props}
                              className="text-lg font-bold text-textMain mt-3 mb-1"
                            />
                          ),
                          h4: ({ node, ...props }) => (
                            <h4
                              {...props}
                              className="text-base font-bold text-textMain mt-2 mb-1"
                            />
                          ),
                          strong: ({ node, ...props }) => (
                            <strong
                              {...props}
                              className="font-semibold text-textMain"
                            />
                          ),
                          em: ({ node, ...props }) => (
                            <em
                              {...props}
                              className="italic text-textMain/90"
                            />
                          ),
                          blockquote: ({ node, ...props }) => (
                            <blockquote
                              {...props}
                              className="border-l-[3px] border-brand/40 pl-4 py-1 my-2 text-textMuted italic bg-surfaceHighlight/5 rounded-r"
                            />
                          ),
                          code: ({ node, className, ...props }) => (
                            <code
                              {...props}
                              className={clsx(
                                'bg-surfaceHighlight border border-border/50 rounded px-1.5 py-[1px] text-[85%] font-mono text-accent',
                                className
                              )}
                            />
                          ),
                          pre: ({ node, ...props }) => (
                            <pre
                              {...props}
                              className="bg-black/40 border border-border/50 rounded-lg p-4 my-3 overflow-x-auto text-sm font-mono text-textMuted/90 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
                            />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul
                              {...props}
                              className="list-disc list-outside ml-5 mb-2 space-y-1 text-textMuted marker:text-brand/50"
                            />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol
                              {...props}
                              className="list-decimal list-outside ml-5 mb-2 space-y-1 text-textMuted marker:text-brand/50"
                            />
                          ),
                          a: ({ node, ...props }) => (
                            <a
                              {...props}
                              className="text-brand hover:underline hover:text-accentHover transition-colors cursor-pointer"
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ),
                          p: ({ node, ...props }) => (
                            <p {...props} className="mb-1 last:mb-0" />
                          ),
                          img: ({ node, src, alt, ...props }) => {
                            if (
                              src &&
                              vaultPath &&
                              !src.startsWith('http://') &&
                              !src.startsWith('https://') &&
                              !src.startsWith('data:')
                            ) {
                              return (
                                <NoteImage
                                  src={src}
                                  alt={alt}
                                  vaultPath={vaultPath}
                                />
                              )
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
                        }}
                      >
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
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} className="h-4" />
        </div>
      </div>
    )
  }
)
