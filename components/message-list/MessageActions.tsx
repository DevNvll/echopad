import React from 'react'
import { Pencil, Copy, Trash2, Check, X, Star } from 'lucide-react'
import { clsx } from 'clsx'

interface MessageActionsProps {
  filename: string
  content: string
  isFavorite: boolean
  copiedMessageId: string | null
  deleteConfirmId: string | null
  onEdit: () => void
  onCopy: () => void
  onDelete: () => void
  onDeleteCancel: () => void
  onDeleteConfirm: () => void
  onToggleFavorite: () => void
}

export const MessageActions: React.FC<MessageActionsProps> = React.memo(
  ({
    filename,
    isFavorite,
    copiedMessageId,
    deleteConfirmId,
    onEdit,
    onCopy,
    onDelete,
    onDeleteCancel,
    onDeleteConfirm,
    onToggleFavorite
  }) => {
    const isCopied = copiedMessageId === filename
    const isDeleting = deleteConfirmId === filename

    return (
      <div className="flex items-center gap-0.5 mt-1 -ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite()
          }}
          className={clsx(
            'h-6 w-6 flex items-center justify-center rounded transition-colors',
            isFavorite 
              ? 'text-amber-400 hover:text-amber-300' 
              : 'text-textMuted/50 hover:text-amber-400'
          )}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star size={12} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="h-6 w-6 flex items-center justify-center text-textMuted/50 hover:text-textMain rounded transition-colors"
          title="Edit"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onCopy()
          }}
          className={clsx(
            'h-6 w-6 flex items-center justify-center rounded transition-colors',
            isCopied ? 'text-green-400' : 'text-textMuted/50 hover:text-textMain'
          )}
          title="Copy"
        >
          {isCopied ? <Check size={12} /> : <Copy size={12} />}
        </button>
        {isDeleting ? (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDeleteConfirm()
              }}
              className="h-6 px-2 flex items-center gap-1 text-[10px] font-medium text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded transition-colors"
            >
              <Trash2 size={10} />
              <span>Delete</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDeleteCancel()
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
              onDelete()
            }}
            className="h-6 w-6 flex items-center justify-center text-textMuted/50 hover:text-red-400 rounded transition-colors"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    )
  }
)

MessageActions.displayName = 'MessageActions'


