import React from 'react'
import ReactMarkdown from 'react-markdown'
import { clsx } from 'clsx'
import { Note } from '../../types'
import { LinkPreview } from '../LinkPreview'
import { EditTextarea } from './EditTextarea'
import { MessageActions } from './MessageActions'

interface MessageItemProps {
  note: Note
  isGrouped: boolean
  isEditing: boolean
  copiedMessageId: string | null
  deleteConfirmId: string | null
  markdownComponents: Record<string, React.ComponentType<any>>
  onContextMenu: (e: React.MouseEvent) => void
  onEdit: () => void
  onEditSubmit: (content: string) => void
  onEditCancel: () => void
  onCopy: () => void
  onDelete: () => void
  onDeleteCancel: () => void
  onDeleteConfirm: () => void
  onTagClick: (tag: string) => void
}

export const MessageItem: React.FC<MessageItemProps> = React.memo(
  ({
    note,
    isGrouped,
    isEditing,
    copiedMessageId,
    deleteConfirmId,
    markdownComponents,
    onContextMenu,
    onEdit,
    onEditSubmit,
    onEditCancel,
    onCopy,
    onDelete,
    onDeleteCancel,
    onDeleteConfirm,
    onTagClick
  }) => {
    const formattedTime = new Date(note.createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })

    return (
      <div
        id={`message-${note.filename}`}
        onContextMenu={(e) => {
          e.preventDefault()
          onContextMenu(e)
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
                {formattedTime}
              </span>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <EditTextarea
                initialContent={note.content}
                onSubmit={onEditSubmit}
                onCancel={onEditCancel}
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
                          onTagClick(tag)
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

                <MessageActions
                  filename={note.filename}
                  content={note.content}
                  copiedMessageId={copiedMessageId}
                  deleteConfirmId={deleteConfirmId}
                  onEdit={onEdit}
                  onCopy={onCopy}
                  onDelete={onDelete}
                  onDeleteCancel={onDeleteCancel}
                  onDeleteConfirm={onDeleteConfirm}
                />
              </>
            )}
          </div>
        </div>
      </div>
    )
  }
)

MessageItem.displayName = 'MessageItem'

