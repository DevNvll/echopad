import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
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

// Flattened item types for virtualization
type VirtualListItem =
  | { type: 'date-separator'; label: string; id: string }
  | { type: 'message'; note: Note; isGrouped: boolean }

// Estimated sizes for virtualization
const ESTIMATED_MESSAGE_SIZE = 80
const ESTIMATED_SEPARATOR_SIZE = 40

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
    loadMoreNotes,
    toggleFavorite,
    clearTarget
  } = useNotesStore()
  const { syncNoteTags, removeNoteTags } = useTagsStore()
  const { openCommand, openContextMenu, closeContextMenu } = useUIStore()

  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const deleteConfirmIdRef = useRef(deleteConfirmId)
  deleteConfirmIdRef.current = deleteConfirmId

  const firstVisibleFilenameRef = useRef<string | null>(null)
  const isLoadingMoreRef = useRef(false)
  const isRestoringScrollRef = useRef(false)

  const markdownComponents = useMarkdownComponents(vaultPath)

  const flattenedItems = useMemo<VirtualListItem[]>(() => {
    const items: VirtualListItem[] = []

    notes.forEach((note, index) => {
      const prevNote = index > 0 ? notes[index - 1] : null
      const isGrouped = shouldGroupMessages(
        note.createdAt,
        prevNote?.createdAt || null
      )
      const dateLabel = formatMessageDate(note.createdAt)
      const isEditing = editingMessageId === note.filename

      // Add date separator if not grouped and not editing
      if (!isGrouped && !isEditing) {
        items.push({
          type: 'date-separator',
          label: dateLabel,
          id: `separator-${note.filename}`
        })
      }

      // Add the message
      items.push({
        type: 'message',
        note,
        isGrouped
      })
    })

    return items
  }, [notes, editingMessageId])

  const noteIndexMap = useMemo(() => {
    const map = new Map<string, number>()
    flattenedItems.forEach((item, index) => {
      if (item.type === 'message') {
        map.set(item.note.filename, index)
      }
    })
    return map
  }, [flattenedItems])

  const virtualizer = useVirtualizer({
    count: flattenedItems.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) => {
      const item = flattenedItems[index]
      return item?.type === 'date-separator'
        ? ESTIMATED_SEPARATOR_SIZE
        : ESTIMATED_MESSAGE_SIZE
    },
    overscan: 5
  })

  const virtualItems = virtualizer.getVirtualItems()

  const handleScroll = useCallback(() => {
    if (isRestoringScrollRef.current) return

    if (deleteConfirmIdRef.current) {
      setDeleteConfirmId(null)
    }
    closeContextMenu()

    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        scrollContainerRef.current
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight
      setShowScrollToBottom(distanceFromBottom > 200)

      if (
        scrollTop < 100 &&
        hasMore &&
        !isLoadingMore &&
        !isLoadingMoreRef.current &&
        vaultPath &&
        activeNotebook
      ) {
        // Capture the first visible item's filename before loading
        const visibleItems = virtualizer.getVirtualItems()
        const firstVisibleItem = visibleItems.find((vi) => {
          const item = flattenedItems[vi.index]
          return item?.type === 'message'
        })
        if (firstVisibleItem) {
          const item = flattenedItems[firstVisibleItem.index]
          if (item?.type === 'message') {
            firstVisibleFilenameRef.current = item.note.filename
          }
        }

        isLoadingMoreRef.current = true
        loadMoreNotes(vaultPath, activeNotebook).finally(() => {
          isLoadingMoreRef.current = false
        })
      }
    }
  }, [
    closeContextMenu,
    hasMore,
    isLoadingMore,
    vaultPath,
    activeNotebook,
    loadMoreNotes,
    virtualizer,
    flattenedItems
  ])

  useEffect(() => {
    if (firstVisibleFilenameRef.current && !isLoadingMore) {
      const targetFilename = firstVisibleFilenameRef.current
      const targetIndex = noteIndexMap.get(targetFilename)

      if (targetIndex !== undefined) {
        isRestoringScrollRef.current = true

        requestAnimationFrame(() => {
          virtualizer.scrollToIndex(targetIndex, { align: 'start' })

          requestAnimationFrame(() => {
            isRestoringScrollRef.current = false
          })
        })
      }

      firstVisibleFilenameRef.current = null
    }
  }, [noteIndexMap, isLoadingMore, virtualizer])

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

  const handleToggleFavorite = useCallback(
    async (filename: string, notebookPath: string) => {
      await toggleFavorite(filename, notebookPath)
    },
    [toggleFavorite]
  )

  const lastNoteRef = useRef<string | null>(null)
  const hasInitialScrolled = useRef(false)

  useEffect(() => {
    lastNoteRef.current = null
    hasInitialScrolled.current = false
    firstVisibleFilenameRef.current = null
    isRestoringScrollRef.current = false
  }, [activeNotebook])

  useEffect(() => {
    if (isLoading || notes.length === 0) return

    if (targetMessageId) {
      hasInitialScrolled.current = true
      lastNoteRef.current = notes[notes.length - 1]?.filename
      return
    }

    const currentLastNote = notes[notes.length - 1]?.filename

    const isInitialLoad = !hasInitialScrolled.current
    const isNewNoteAdded =
      lastNoteRef.current !== null && currentLastNote !== lastNoteRef.current

    if (isInitialLoad || isNewNoteAdded) {
      hasInitialScrolled.current = true

      const scrollAttempts = isInitialLoad
        ? [0, 16, 50, 100, 200, 300]
        : [0, 16]
      const timeoutIds: number[] = []

      scrollAttempts.forEach((delay) => {
        const id = window.setTimeout(() => {
          scrollToBottom()
        }, delay)
        timeoutIds.push(id)
      })

      lastNoteRef.current = currentLastNote

      return () => {
        timeoutIds.forEach((id) => window.clearTimeout(id))
      }
    }

    lastNoteRef.current = currentLastNote
  }, [notes, isLoading, scrollToBottom, targetMessageId])

  useEffect(() => {
    if (isLoading || !targetMessageId) return

    const targetIndex = noteIndexMap.get(targetMessageId)
    if (targetIndex !== undefined) {
      const timer = setTimeout(() => {
        virtualizer.scrollToIndex(targetIndex, { align: 'center' })

        setTimeout(() => {
          const element = document.getElementById(`message-${targetMessageId}`)
          if (element) {
            element.classList.add('bg-brand/10', 'ring-1', 'ring-brand/20')
            setTimeout(() => {
              element.classList.remove('bg-brand/10', 'ring-1', 'ring-brand/20')
              // Clear target after highlight animation completes
              clearTarget()
            }, 2500)
          } else {
            clearTarget()
          }
        }, 100)
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [targetMessageId, isLoading, noteIndexMap, virtualizer, clearTarget])

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
        <div className="w-full max-w-3xl mx-auto px-6 pb-28">
          {isLoadingMore && <LoadingMoreIndicator />}

          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: '100%',
              position: 'relative'
            }}
          >
            {virtualItems.map((virtualItem) => {
              const item = flattenedItems[virtualItem.index]
              if (!item) return null

              if (item.type === 'date-separator') {
                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`
                    }}
                  >
                    <DateSeparator label={item.label} />
                  </div>
                )
              }

              const { note, isGrouped } = item
              const isEditing = editingMessageId === note.filename

              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`
                  }}
                >
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
                    onToggleFavorite={() =>
                      handleToggleFavorite(note.filename, note.notebookName)
                    }
                  />
                </div>
              )
            })}
          </div>
          <div ref={bottomRef} className="h-px" />
        </div>
      </div>

      {showScrollToBottom && <ScrollToBottomButton onClick={scrollToBottom} />}
    </div>
  )
})
