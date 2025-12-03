import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Notebook } from '../types'
import {
  Hash,
  Plus,
  Pin,
  PinOff,
  ChevronDown,
  ChevronRight,
  Check,
  Settings,
  LayoutDashboard,
  Cloud
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  useVaultStore,
  useNotebookStore,
  useUIStore,
  useSyncStore,
  useRouterStore
} from '../stores'
import { getIconByName } from './IconPicker'
import { useKnownVaults, useVaultIcons } from '../hooks'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface SidebarProps {
  width: number
}

// Sortable pinned notebook item
interface SortablePinnedItemProps {
  notebook: Notebook
  activeNotebook: string | null
  onSelectNotebook: (relativePath: string) => void
  onContextMenu: (e: React.MouseEvent, notebook: Notebook) => void
  onTogglePin: (notebook: Notebook) => void
}

const SortablePinnedItem: React.FC<SortablePinnedItemProps> = ({
  notebook,
  activeNotebook,
  onSelectNotebook,
  onContextMenu,
  onTogglePin
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: notebook.relativePath })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative group/item cursor-grab active:cursor-grabbing"
    >
      <button
        onClick={() => onSelectNotebook(notebook.relativePath)}
        onContextMenu={(e) => {
          e.preventDefault()
          onContextMenu(e, notebook)
        }}
        className={clsx(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mx-0 transition-all text-[14px] group relative font-medium',
          activeNotebook === notebook.relativePath
            ? 'bg-surfaceHighlight text-textMain shadow-sm'
            : 'text-textMuted hover:bg-surfaceHighlight/40 hover:text-textMain/90'
        )}
      >
        <Hash
          size={16}
          className={clsx(
            'shrink-0',
            activeNotebook === notebook.relativePath
              ? 'text-brand'
              : 'text-textMuted/60 group-hover:text-textMuted'
          )}
        />
        <span className="truncate leading-none pb-px flex-1 text-left">
          {notebook.name}
        </span>

        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation()
            onTogglePin(notebook)
          }}
          className="opacity-100 text-brand hover:text-brand transition-opacity p-1 hover:bg-surfaceHighlight rounded"
          title="Unpin Notebook"
        >
          <PinOff size={12} />
        </div>
      </button>
    </div>
  )
}

// Sortable notebook tree item wrapper
interface SortableNotebookItemProps {
  notebook: Notebook
  activeNotebook: string | null
  onSelectNotebook: (relativePath: string) => void
  onCreateSubnotebook: (parent: Notebook) => void
  onContextMenu: (e: React.MouseEvent, notebook: Notebook) => void
  onTogglePin: (notebook: Notebook) => void
  expandedPaths: Set<string>
  onToggleExpand: (path: string) => void
  depth: number
}

const SortableNotebookItem: React.FC<SortableNotebookItemProps> = ({
  notebook,
  activeNotebook,
  onSelectNotebook,
  onCreateSubnotebook,
  onContextMenu,
  onTogglePin,
  expandedPaths,
  onToggleExpand,
  depth
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: notebook.relativePath })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const hasChildren = notebook.children && notebook.children.length > 0
  const isExpanded = expandedPaths.has(notebook.relativePath)
  const isActive = activeNotebook === notebook.relativePath

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      <div className="relative group/item">
        <button
          onClick={() => onSelectNotebook(notebook.relativePath)}
          onContextMenu={(e) => {
            e.preventDefault()
            onContextMenu(e, notebook)
          }}
          className={clsx(
            'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all text-[14px] group relative font-medium',
            isActive
              ? 'bg-surfaceHighlight text-textMain shadow-sm'
              : 'text-textMuted hover:bg-surfaceHighlight/40 hover:text-textMain/90'
          )}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <div
            role={hasChildren ? 'button' : undefined}
            tabIndex={hasChildren ? 0 : undefined}
            onClick={
              hasChildren
                ? (e) => {
                    e.stopPropagation()
                    onToggleExpand(notebook.relativePath)
                  }
                : undefined
            }
            className={clsx(
              'shrink-0 p-0.5 rounded w-[18px] h-[18px] flex items-center justify-center',
              hasChildren &&
                'hover:bg-surfaceHighlight text-textMuted/60 hover:text-textMuted cursor-pointer'
            )}
          >
            {hasChildren &&
              (isExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              ))}
          </div>

          <Hash
            size={16}
            className={clsx(
              'shrink-0',
              isActive
                ? 'text-brand'
                : 'text-textMuted/60 group-hover:text-textMuted'
            )}
          />

          <span className="truncate leading-none flex-1 text-left">
            {notebook.name}
          </span>

          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onCreateSubnotebook(notebook)
              }}
              className="p-1 hover:bg-surfaceHighlight rounded text-textMuted hover:text-textMain"
              title="Create Subnotebook"
            >
              <Plus size={12} />
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onTogglePin(notebook)
              }}
              className={clsx(
                'p-1 hover:bg-surfaceHighlight rounded text-textMuted hover:text-textMain',
                notebook.isPinned && 'opacity-100! text-brand hover:text-brand'
              )}
              title={notebook.isPinned ? 'Unpin Notebook' : 'Pin Notebook'}
            >
              {notebook.isPinned ? <PinOff size={12} /> : <Pin size={12} />}
            </div>
          </div>
        </button>
      </div>

      {hasChildren && isExpanded && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {notebook.children!.map((child) => (
            <NotebookTreeItem
              key={child.relativePath}
              notebook={child}
              activeNotebook={effectiveActiveNotebook}
              onSelectNotebook={onSelectNotebook}
              onCreateSubnotebook={onCreateSubnotebook}
              onContextMenu={onContextMenu}
              onTogglePin={onTogglePin}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface NotebookTreeItemProps {
  notebook: Notebook
  activeNotebook: string | null
  onSelectNotebook: (relativePath: string) => void
  onCreateSubnotebook: (parent: Notebook) => void
  onContextMenu: (e: React.MouseEvent, notebook: Notebook) => void
  onTogglePin: (notebook: Notebook) => void
  expandedPaths: Set<string>
  onToggleExpand: (path: string) => void
  depth: number
}

const NotebookTreeItem: React.FC<NotebookTreeItemProps> = ({
  notebook,
  activeNotebook,
  onSelectNotebook,
  onCreateSubnotebook,
  onContextMenu,
  onTogglePin,
  expandedPaths,
  onToggleExpand,
  depth
}) => {
  const hasChildren = notebook.children && notebook.children.length > 0
  const isExpanded = expandedPaths.has(notebook.relativePath)
  const isActive = activeNotebook === notebook.relativePath

  return (
    <div>
      <button
        onClick={() => onSelectNotebook(notebook.relativePath)}
        onContextMenu={(e) => {
          e.preventDefault()
          onContextMenu(e, notebook)
        }}
        className={clsx(
          'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all text-[14px] group relative font-medium',
          isActive
            ? 'bg-surfaceHighlight text-textMain shadow-sm'
            : 'text-textMuted hover:bg-surfaceHighlight/40 hover:text-textMain/90'
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <div
          role={hasChildren ? 'button' : undefined}
          tabIndex={hasChildren ? 0 : undefined}
          onClick={
            hasChildren
              ? (e) => {
                  e.stopPropagation()
                  onToggleExpand(notebook.relativePath)
                }
              : undefined
          }
          className={clsx(
            'shrink-0 p-0.5 rounded w-[18px] h-[18px] flex items-center justify-center',
            hasChildren &&
              'hover:bg-surfaceHighlight text-textMuted/60 hover:text-textMuted cursor-pointer'
          )}
        >
          {hasChildren &&
            (isExpanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            ))}
        </div>

        <Hash
          size={16}
          className={clsx(
            'shrink-0',
            isActive
              ? 'text-brand'
              : 'text-textMuted/60 group-hover:text-textMuted'
          )}
        />

        <span className="truncate leading-none flex-1 text-left">
          {notebook.name}
        </span>

        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onCreateSubnotebook(notebook)
            }}
            className="p-1 hover:bg-surfaceHighlight rounded text-textMuted hover:text-textMain"
            title="Create Subnotebook"
          >
            <Plus size={12} />
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onTogglePin(notebook)
            }}
            className={clsx(
              'p-1 hover:bg-surfaceHighlight rounded text-textMuted hover:text-textMain',
              notebook.isPinned && 'opacity-100! text-brand hover:text-brand'
            )}
            title={notebook.isPinned ? 'Unpin Notebook' : 'Pin Notebook'}
          >
            {notebook.isPinned ? <PinOff size={12} /> : <Pin size={12} />}
          </div>
        </div>
      </button>

      {hasChildren && isExpanded && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {notebook.children!.map((child) => (
            <NotebookTreeItem
              key={child.relativePath}
              notebook={child}
              activeNotebook={effectiveActiveNotebook}
              onSelectNotebook={onSelectNotebook}
              onCreateSubnotebook={onCreateSubnotebook}
              onContextMenu={onContextMenu}
              onTogglePin={onTogglePin}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Helper to flatten all notebooks
const flattenAllNotebooks = (notebooks: Notebook[]): Notebook[] => {
  const result: Notebook[] = []
  for (const nb of notebooks) {
    result.push(nb)
    if (nb.children) {
      result.push(...flattenAllNotebooks(nb.children))
    }
  }
  return result
}

export const Sidebar: React.FC<SidebarProps> = ({ width }) => {
  const { vaultPath, switchVault } = useVaultStore()
  const {
    notebooks,
    activeNotebook,
    selectNotebook,
    togglePin,
    setActiveNotebook,
    pinnedOrder,
    notebookOrder,
    reorderPinnedNotebooks,
    reorderNotebooks
  } = useNotebookStore()
  const { openCreateModal, openContextMenu, openSettings } = useUIStore()
  const { vaultStatuses } = useSyncStore()
  const { currentRoute, navigateToDashboard } = useRouterStore()

  const isDashboardActive = currentRoute.type === 'dashboard'
  const effectiveActiveNotebook = currentRoute.type === 'notebook' ? activeNotebook : null

  const [isVaultDropdownOpen, setIsVaultDropdownOpen] = useState(false)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { data: knownVaults = [] } = useKnownVaults()
  const { data: vaultIcons = {} } = useVaultIcons(knownVaults)

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  // Helper to check if a vault is synced
  const isVaultSynced = useCallback(
    (path: string) => {
      return vaultStatuses.some((v) => v.vault_path === path && v.enabled)
    },
    [vaultStatuses]
  )

  // Compute sorted pinned notebooks (subscribing to state changes)
  const pinnedNotebooks = useMemo(() => {
    const allNbs = flattenAllNotebooks(notebooks)
    const pinnedNbs = allNbs.filter((nb) => nb.isPinned)
    return pinnedNbs.sort((a, b) => {
      const aIdx = pinnedOrder.indexOf(a.relativePath)
      const bIdx = pinnedOrder.indexOf(b.relativePath)
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
      if (aIdx !== -1) return -1
      if (bIdx !== -1) return 1
      return a.name.localeCompare(b.name)
    })
  }, [notebooks, pinnedOrder])

  // Compute sorted top-level notebooks (subscribing to state changes)
  const topLevelNotebooks = useMemo(() => {
    return [...notebooks].sort((a, b) => {
      const aIdx = notebookOrder.indexOf(a.relativePath)
      const bIdx = notebookOrder.indexOf(b.relativePath)
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
      if (aIdx !== -1) return -1
      if (bIdx !== -1) return 1
      return a.name.localeCompare(b.name)
    })
  }, [notebooks, notebookOrder])

  const vaultName = vaultPath?.split(/[/\\]/).pop() || 'Unknown Vault'
  const currentVaultIcon = vaultPath
    ? vaultIcons[vaultPath] || 'FolderOpen'
    : 'FolderOpen'
  const CurrentVaultIconComponent = getIconByName(currentVaultIcon)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsVaultDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (activeNotebook && activeNotebook.includes('/')) {
      const parts = activeNotebook.split('/')
      const pathsToExpand: string[] = []
      for (let i = 1; i < parts.length; i++) {
        pathsToExpand.push(parts.slice(0, i).join('/'))
      }
      setExpandedPaths((prev) => {
        const newSet = new Set(prev)
        pathsToExpand.forEach((p) => newSet.add(p))
        return newSet
      })
    }
  }, [activeNotebook])

  const handleToggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(path)) {
        newSet.delete(path)
      } else {
        newSet.add(path)
      }
      return newSet
    })
  }, [])

  const handleSelectNotebook = useCallback(
    (relativePath: string) => {
      selectNotebook(relativePath)
    },
    [selectNotebook]
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, notebook: Notebook) => {
      openContextMenu({
        x: e.clientX,
        y: e.clientY,
        type: 'notebook',
        data: notebook
      })
    },
    [openContextMenu]
  )

  // Handle pinned section drag end
  const handlePinnedDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (over && active.id !== over.id) {
        const paths = pinnedNotebooks.map((nb) => nb.relativePath)
        const oldIndex = paths.indexOf(active.id as string)
        const newIndex = paths.indexOf(over.id as string)

        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(paths, oldIndex, newIndex) as string[]
          reorderPinnedNotebooks(newOrder)
        }
      }
    },
    [pinnedNotebooks, reorderPinnedNotebooks]
  )

  // Handle notebooks section drag end
  const handleNotebooksDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (over && active.id !== over.id) {
        const paths = topLevelNotebooks.map((nb) => nb.relativePath)
        const oldIndex = paths.indexOf(active.id as string)
        const newIndex = paths.indexOf(over.id as string)

        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(paths, oldIndex, newIndex) as string[]
          reorderNotebooks(newOrder)
        }
      }
    },
    [topLevelNotebooks, reorderNotebooks]
  )

  return (
    <div
      style={{ width: `${width}px` }}
      className="bg-sidebar flex flex-col h-full border-r border-border/40 shrink-0 relative"
    >
      <div
        className="h-16 px-3 flex items-center border-b border-border/30 relative"
        ref={dropdownRef}
      >
        <button
          onClick={() => setIsVaultDropdownOpen(!isVaultDropdownOpen)}
          className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-surfaceHighlight/40 hover:bg-surfaceHighlight/60 transition-colors group"
        >
          <div className="w-8 h-8 rounded-lg bg-linear-to-br from-brand/20 to-brand/5 border border-brand/20 flex items-center justify-center shrink-0">
            <CurrentVaultIconComponent size={16} className="text-brand" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[13px] font-semibold text-textMain truncate leading-tight flex items-center gap-1.5">
              {vaultName}
              {vaultPath && isVaultSynced(vaultPath) && (
                <Cloud size={12} className="text-brand shrink-0" />
              )}
            </div>
            <div className="text-[11px] text-textMuted truncate">
              Current vault
            </div>
          </div>
          <ChevronDown
            size={16}
            className={clsx(
              'text-textMuted transition-transform shrink-0',
              isVaultDropdownOpen && 'rotate-180'
            )}
          />
        </button>

        {isVaultDropdownOpen && (
          <div className="absolute top-full left-3 right-3 mt-1 bg-surface border border-border rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="p-1.5 max-h-[200px] overflow-y-auto">
              {knownVaults.map((vault) => {
                const isActive = vault.path === vaultPath
                const isSynced = isVaultSynced(vault.path)
                const VaultIcon = getIconByName(
                  vaultIcons[vault.path] || 'FolderOpen'
                )
                return (
                  <button
                    key={vault.path}
                    onClick={() => {
                      setIsVaultDropdownOpen(false)
                      if (!isActive) {
                        switchVault(vault.path)
                      }
                    }}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors group',
                      isActive ? 'bg-brand/10' : 'hover:bg-surfaceHighlight/50'
                    )}
                  >
                    <VaultIcon
                      size={16}
                      className={
                        isActive
                          ? 'text-brand shrink-0'
                          : 'text-textMuted shrink-0'
                      }
                    />
                    <span className="text-[13px] text-textMain truncate flex-1 flex items-center gap-1.5">
                      {vault.name}
                      {isSynced && (
                        <Cloud size={12} className="text-brand shrink-0" />
                      )}
                    </span>
                    {isActive && (
                      <Check size={14} className="text-brand shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
            <div className="border-t border-border/50">
              <button
                onClick={() => {
                  setIsVaultDropdownOpen(false)
                  openSettings('storage')
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surfaceHighlight/30 transition-colors"
              >
                <Settings size={16} className="text-textMuted shrink-0" />
                <span className="text-[13px] text-textMuted">
                  Manage vaults...
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar flex flex-col gap-1">
        <button
          onClick={() => {
            setActiveNotebook(null)
            navigateToDashboard()
          }}
          className={clsx(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-[14px] group relative font-medium mb-2',
            isDashboardActive
              ? 'bg-surfaceHighlight text-textMain shadow-sm'
              : 'text-textMuted hover:bg-surfaceHighlight/40 hover:text-textMain/90'
          )}
        >
          <LayoutDashboard
            size={16}
            className={clsx(
              'shrink-0',
              isDashboardActive
                ? 'text-brand'
                : 'text-textMuted/60 group-hover:text-textMuted'
            )}
          />
          <span className="truncate leading-none flex-1 text-left">
            Dashboard
          </span>
        </button>

        {pinnedNotebooks.length > 0 && (
          <div className="mb-3">
            <div className="px-2 pb-2 flex items-center justify-between group mb-1">
              <h3 className="text-[10px] font-bold text-textMuted/60 uppercase tracking-widest group-hover:text-textMuted transition-colors">
                Pinned
              </h3>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handlePinnedDragEnd}
            >
              <SortableContext
                items={pinnedNotebooks.map((nb) => nb.relativePath)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-0.5">
                  {pinnedNotebooks.map((notebook) => (
                    <SortablePinnedItem
                      key={notebook.relativePath}
                      notebook={notebook}
                      activeNotebook={effectiveActiveNotebook}
                      onSelectNotebook={handleSelectNotebook}
                      onContextMenu={handleContextMenu}
                      onTogglePin={togglePin}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <div className="my-3 border-b border-border/30 mx-2" />
          </div>
        )}

        <div>
          <div className="px-2 pb-2 flex items-center justify-between group mb-1">
            <h3 className="text-[10px] font-bold text-textMuted/60 uppercase tracking-widest group-hover:text-textMuted transition-colors">
              Notebooks
            </h3>
            <button
              onClick={() => openCreateModal()}
              className="text-textMuted hover:text-textMain opacity-0 group-hover:opacity-100 transition-all p-1 rounded hover:bg-surfaceHighlight"
              title="Create Notebook"
            >
              <Plus size={14} strokeWidth={3} />
            </button>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleNotebooksDragEnd}
          >
            <SortableContext
              items={topLevelNotebooks.map((nb) => nb.relativePath)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-0.5">
                {topLevelNotebooks.map((notebook) => (
                  <SortableNotebookItem
                    key={notebook.relativePath}
                    notebook={notebook}
                    activeNotebook={effectiveActiveNotebook}
                    onSelectNotebook={handleSelectNotebook}
                    onCreateSubnotebook={(parent) => openCreateModal(parent)}
                    onContextMenu={handleContextMenu}
                    onTogglePin={togglePin}
                    expandedPaths={expandedPaths}
                    onToggleExpand={handleToggleExpand}
                    depth={0}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  )
}
