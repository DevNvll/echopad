import { useState } from 'react'
import { Plus, MoreVertical, Trash2, Edit2 } from 'lucide-react'
import { KanbanColumn as Column } from '../../types'
import { KanbanCard } from './KanbanCard'
import { useBoardStore } from '../../stores/boardStore'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDroppable } from '@dnd-kit/core'
import { clsx } from 'clsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

interface KanbanColumnProps {
  column: Column
  onSave: () => void
}

export function KanbanColumn({ column, onSave }: KanbanColumnProps) {
  const { addCard, removeColumn, renameColumn } = useBoardStore()
  const [isAddingCard, setIsAddingCard] = useState(false)
  const [newCardContent, setNewCardContent] = useState('')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState(column.title)

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: column.id })

  const { setNodeRef: setDroppableRef } = useDroppable({
    id: column.id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  const handleAddCard = () => {
    if (newCardContent.trim()) {
      addCard(column.id, newCardContent.trim())
      setNewCardContent('')
      setIsAddingCard(false)
      onSave()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAddCard()
    }
    if (e.key === 'Escape') {
      setNewCardContent('')
      setIsAddingCard(false)
    }
  }

  const handleRenameColumn = () => {
    if (editedTitle.trim() && editedTitle !== column.title) {
      renameColumn(column.id, editedTitle.trim())
      onSave()
    }
    setIsEditingTitle(false)
  }

  const handleDeleteColumn = () => {
    removeColumn(column.id)
    onSave()
  }

  return (
    <div
      ref={setSortableRef}
      style={style}
      className={clsx(
        'flex flex-col w-72 bg-surfaceHighlight/30 rounded-xl border border-border/30 shrink-0 max-h-full',
        isDragging && 'opacity-50'
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="p-3 border-b border-border/30 flex items-center justify-between cursor-grab active:cursor-grabbing"
      >
        {isEditingTitle ? (
          <input
            autoFocus
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleRenameColumn}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameColumn()
              if (e.key === 'Escape') {
                setEditedTitle(column.title)
                setIsEditingTitle(false)
              }
            }}
            className="flex-1 bg-transparent text-textMain font-semibold text-sm outline-none"
          />
        ) : (
          <h3 className="font-semibold text-textMain text-sm flex items-center gap-2">
            {column.title}
            <span className="text-xs text-textMuted font-normal">
              {column.cards.length}
            </span>
          </h3>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 hover:bg-surfaceHighlight rounded text-textMuted hover:text-textMain">
              <MoreVertical size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => setIsEditingTitle(true)}>
              <Edit2 size={14} className="mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDeleteColumn}
              className="text-red-400 focus:text-red-400"
            >
              <Trash2 size={14} className="mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        ref={setDroppableRef}
        className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]"
      >
        <SortableContext
          items={column.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              columnId={column.id}
              onSave={onSave}
            />
          ))}
        </SortableContext>

        {isAddingCard ? (
          <div className="bg-surface rounded-lg p-3 border border-border/30">
            <textarea
              autoFocus
              value={newCardContent}
              onChange={(e) => setNewCardContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter card content..."
              className="w-full bg-transparent text-textMain text-sm resize-none outline-none min-h-[60px]"
              rows={3}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleAddCard}
                className="px-3 py-1.5 bg-brand text-white rounded-md text-xs font-medium hover:bg-brand/90"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setIsAddingCard(false)
                  setNewCardContent('')
                }}
                className="px-3 py-1.5 text-textMuted hover:text-textMain text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingCard(true)}
            className="w-full p-2 text-left text-textMuted hover:text-textMain hover:bg-surfaceHighlight/50 rounded-lg flex items-center gap-2 text-sm transition-colors"
          >
            <Plus size={14} />
            <span>Add card</span>
          </button>
        )}
      </div>
    </div>
  )
}
