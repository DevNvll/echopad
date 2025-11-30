import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Note } from '../../types'
import { formatMessageDate, shouldGroupMessages } from '../../utils/formatting'
import {
  useVaultStore,
  useNotebookStore,
  useNotesStore,
  useTagsStore,
  useUIStore
} from '../../stores'
import { DateSeparator } from './DateSeparator'
import { MessageItem } from './MessageItem'
import { EmptyState } from './EmptyState'
import { LoadingState, LoadingMoreIndicator } from './LoadingState'
import { ScrollToBottomButton } from './ScrollToBottomButton'
import { useMarkdownComponents } from './useMarkdownComponents'

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

  const markdownComponents = useMarkdownComponents(vaultPath)

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

  const handleCopy = useCallback((content: string, filename: string) => {
    navigator.clipboard.writeText(content)
    setCopiedMessageId(filename)
    setTimeout(() => setCopiedMessageId(null), 1500)
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

  if (isLoading) {
    return <LoadingState />
  }

  if (notes.length === 0) {
    const notebookName = activeNotebook
      ? activeNotebook.split('/').pop() || 'notebook'
      : 'notebook'

    return <EmptyState notebookName={notebookName} />
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
          {isLoadingMore && <LoadingMoreIndicator />}
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
                {!isGrouped && !isEditing && (
                  <DateSeparator label={dateLabel} />
                )}

                <MessageItem
                  note={note}
                  isGrouped={isGrouped}
                  isEditing={isEditing}
                  copiedMessageId={copiedMessageId}
                  deleteConfirmId={deleteConfirmId}
                  markdownComponents={markdownComponents}
                  onContextMenu={(e) => handleContextMenu(e, note)}
                  onEdit={() => setEditing(note.filename)}
                  onEditSubmit={(content) =>
                    handleEditSubmit(note.filename, content)
                  }
                  onEditCancel={() => setEditing(null)}
                  onCopy={() => handleCopy(note.content, note.filename)}
                  onDelete={() => setDeleteConfirmId(note.filename)}
                  onDeleteCancel={() => setDeleteConfirmId(null)}
                  onDeleteConfirm={() => {
                    handleDelete(note.filename)
                    setDeleteConfirmId(null)
                  }}
                  onTagClick={handleTagClick}
                />
              </div>
            )
          })}
          <div ref={bottomRef} className="h-px" />
        </div>
      </div>

      {showScrollToBottom && <ScrollToBottomButton onClick={scrollToBottom} />}
    </div>
  )
})

