import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { KanbanCard as Card } from '../../types'
import { useBoardStore } from '../../stores/boardStore'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { clsx } from 'clsx'

interface KanbanCardProps {
  card: Card
  columnId: string
  onSave: () => void
  isOverlay?: boolean
}

export function KanbanCard({ card, columnId, onSave, isOverlay }: KanbanCardProps) {
  const { removeCard, updateCard } = useBoardStore()
  const [isEditing, setIsEditing] = useState(false)
  const [content, setContent] = useState(card.content)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: card.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  const handleSave = () => {
    if (content.trim()) {
      updateCard(columnId, card.id, content)
      setIsEditing(false)
      onSave()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      setContent(card.content)
      setIsEditing(false)
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    removeCard(columnId, card.id)
    onSave()
  }

  if (isOverlay) {
    return (
      <div className="bg-surface rounded-lg p-3 border border-brand/50 shadow-xl w-64 rotate-2">
        <p className="text-sm text-textMain whitespace-pre-wrap break-words">
          {card.content}
        </p>
        {card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {card.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 rounded bg-brand/10 text-brand"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={clsx(
        'bg-surface rounded-lg p-3 border border-border/30 hover:border-border/50 transition-colors group cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-30'
      )}
    >
      {isEditing ? (
        <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className="w-full bg-transparent text-textMain text-sm resize-none outline-none min-h-[60px] cursor-text"
            rows={3}
          />
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <div
            className="flex-1 min-w-0"
            onClick={() => setIsEditing(true)}
          >
            <p className="text-sm text-textMain whitespace-pre-wrap break-words">
              {card.content}
            </p>
            {card.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {card.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-1.5 py-0.5 rounded bg-brand/10 text-brand"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleDelete}
            onPointerDown={(e) => e.stopPropagation()}
            className="shrink-0 p-1 hover:bg-surfaceHighlight rounded text-textMuted/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
