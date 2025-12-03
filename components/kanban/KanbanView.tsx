import { useEffect, useState, useMemo } from 'react'
import { PanelLeft, Plus, MoreHorizontal, Trash2, Pin, PinOff, Pencil } from 'lucide-react'
import { useBoardStore } from '../../stores/boardStore'
import { useVaultStore } from '../../stores'
import { useRouterStore } from '../../stores/routerStore'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'

interface KanbanViewProps {
  boardFilename: string
  isSidebarCollapsed: boolean
  onToggleSidebar: () => void
}

export function KanbanView({
  boardFilename,
  isSidebarCollapsed,
  onToggleSidebar
}: KanbanViewProps) {
  const { vaultPath } = useVaultStore()
  const { navigateToDashboard } = useRouterStore()
  const {
    currentBoard,
    loadBoard,
    isLoading,
    addColumn,
    moveCard,
    reorderColumns,
    saveCurrentBoard,
    deleteBoard,
    renameBoard,
    togglePin,
    pinnedBoards
  } = useBoardStore()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const activeCard = useMemo(() => {
    if (!activeId || !currentBoard) return null
    for (const column of currentBoard.columns) {
      const card = column.cards.find((c) => c.id === activeId)
      if (card) return card
    }
    return null
  }, [activeId, currentBoard])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  )

  useEffect(() => {
    if (vaultPath && boardFilename) {
      loadBoard(vaultPath, boardFilename)
    }
  }, [vaultPath, boardFilename, loadBoard])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over || !currentBoard) return

    const activeId = active.id as string
    const overId = over.id as string

    const isActiveCard = activeId.startsWith('card-')
    const isOverColumn = currentBoard.columns.some((c) => c.id === overId)
    const isOverCard = overId.startsWith('card-')

    if (isActiveCard && (isOverColumn || isOverCard)) {
      const activeColumn = currentBoard.columns.find((c) =>
        c.cards.some((card) => card.id === activeId)
      )
      let overColumn = currentBoard.columns.find((c) => c.id === overId)

      if (!overColumn && isOverCard) {
        overColumn = currentBoard.columns.find((c) =>
          c.cards.some((card) => card.id === overId)
        )
      }

      if (activeColumn && overColumn && activeColumn.id !== overColumn.id) {
        const overIndex = isOverCard
          ? overColumn.cards.findIndex((c) => c.id === overId)
          : overColumn.cards.length

        moveCard(activeId, activeColumn.id, overColumn.id, overIndex)
      }
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || !currentBoard || !vaultPath) return

    const activeId = active.id as string
    const overId = over.id as string

    const isActiveCard = activeId.startsWith('card-')
    const isActiveColumn = currentBoard.columns.some((c) => c.id === activeId)

    if (isActiveColumn) {
      const oldIndex = currentBoard.columns.findIndex((c) => c.id === activeId)
      const newIndex = currentBoard.columns.findIndex((c) => c.id === overId)

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const newOrder = arrayMove(
          currentBoard.columns.map((c) => c.id),
          oldIndex,
          newIndex
        )
        reorderColumns(newOrder)
      }
    } else if (isActiveCard) {
      const activeColumn = currentBoard.columns.find((c) =>
        c.cards.some((card) => card.id === activeId)
      )
      if (activeColumn) {
        const oldIndex = activeColumn.cards.findIndex((c) => c.id === activeId)
        const newIndex = activeColumn.cards.findIndex((c) => c.id === overId)

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          moveCard(activeId, activeColumn.id, activeColumn.id, newIndex)
        }
      }
    }

    saveCurrentBoard(vaultPath)
  }

  const handleAddColumn = () => {
    const title = prompt('Enter column name:')
    if (title && vaultPath) {
      addColumn(title)
      saveCurrentBoard(vaultPath)
    }
  }

  const handleDeleteBoard = async () => {
    if (vaultPath && boardFilename) {
      await deleteBoard(vaultPath, boardFilename)
      navigateToDashboard()
    }
    setShowDeleteDialog(false)
  }

  const handleRenameBoard = () => {
    if (!currentBoard || !vaultPath) return
    const newTitle = prompt('Enter new board name:', currentBoard.title)
    if (newTitle && newTitle !== currentBoard.title) {
      renameBoard(vaultPath, boardFilename, newTitle)
    }
  }

  const handleTogglePin = () => {
    if (boardFilename) {
      togglePin(boardFilename)
    }
  }

  const isPinned = pinnedBoards.includes(boardFilename)

  const totalCards = currentBoard?.columns.reduce((sum, col) => sum + col.cards.length, 0) ?? 0

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-textMuted">Loading board...</div>
      </div>
    )
  }

  if (!currentBoard) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-textMuted">Board not found</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <div className="border-b border-border/40 flex items-center px-4 py-3 bg-glass backdrop-blur-md justify-between shrink-0">
        <div className="flex items-center gap-3">
          {isSidebarCollapsed && (
            <button
              onClick={onToggleSidebar}
              className="p-1.5 hover:bg-surfaceHighlight rounded-md text-textMuted hover:text-textMain"
            >
              <PanelLeft size={18} />
            </button>
          )}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-textMain">
                {currentBoard.title}
              </h1>
              {isPinned && <Pin size={12} className="text-accent" />}
            </div>
            <span className="text-xs text-textMuted">
              {currentBoard.columns.length} column{currentBoard.columns.length !== 1 ? 's' : ''} · {totalCards} card{totalCards !== 1 ? 's' : ''} · Created {formatDate(currentBoard.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="text-textMuted hover:text-textMain">
                <MoreHorizontal size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleRenameBoard}>
                <Pencil size={14} />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleTogglePin}>
                {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                {isPinned ? 'Unpin' : 'Pin to sidebar'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 size={14} />
                Delete board
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={handleAddColumn}>
            <Plus size={14} className="mr-1" />
            Add Column
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={currentBoard.columns.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex gap-4 h-full pb-4">
              {currentBoard.columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  onSave={() => vaultPath && saveCurrentBoard(vaultPath)}
                />
              ))}
              {currentBoard.columns.length === 0 && (
                <div className="flex items-center justify-center w-72 h-32 border-2 border-dashed border-border/50 rounded-xl text-textMuted">
                  <button
                    onClick={handleAddColumn}
                    className="flex items-center gap-2 hover:text-textMain transition-colors"
                  >
                    <Plus size={16} />
                    Add your first column
                  </button>
                </div>
              )}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeId && activeCard && (
              <KanbanCard
                card={activeCard}
                columnId=""
                onSave={() => {}}
                isOverlay
              />
            )}
          </DragOverlay>
        </DndContext>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Board</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{currentBoard.title}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBoard}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
