import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Notebook } from '../types'
import {
  Hash,
  Plus,
  Pin,
  PinOff,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Check,
  Settings
} from 'lucide-react'
import { clsx } from 'clsx'
import { getKnownVaults, KnownVault } from '../api'

interface SidebarProps {
  notebooks: Notebook[]
  activeNotebook: string | null
  onSelectNotebook: (relativePath: string) => void
  onCreateNotebook: () => void
  onCreateSubnotebook: (parent: Notebook) => void
  onContextMenu: (e: React.MouseEvent, notebook: Notebook) => void
  onTogglePin: (notebook: Notebook) => void
  width: number
  vaultPath: string | null
  onOpenSettings: (
    section?: 'general' | 'storage' | 'appearance' | 'about'
  ) => void
  onSwitchVault: (path: string) => void
}

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

const collectPinnedNotebooks = (notebooks: Notebook[]): Notebook[] => {
  return flattenAllNotebooks(notebooks).filter((n) => n.isPinned)
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
        {hasChildren && (
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand(notebook.relativePath)
            }}
            className="shrink-0 p-0.5 hover:bg-surfaceHighlight rounded text-textMuted/60 hover:text-textMuted"
          >
            {isExpanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
          </div>
        )}

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
              activeNotebook={activeNotebook}
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

export const Sidebar: React.FC<SidebarProps> = ({
  notebooks,
  activeNotebook,
  onSelectNotebook,
  onCreateNotebook,
  onCreateSubnotebook,
  onContextMenu,
  onTogglePin,
  width,
  vaultPath,
  onOpenSettings,
  onSwitchVault
}) => {
  const [isVaultDropdownOpen, setIsVaultDropdownOpen] = useState(false)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [knownVaults, setKnownVaults] = useState<KnownVault[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)

  const pinnedNotebooks = collectPinnedNotebooks(notebooks)

  const vaultName = vaultPath?.split(/[/\\]/).pop() || 'Unknown Vault'

  useEffect(() => {
    const loadVaults = async () => {
      const vaults = await getKnownVaults()
      setKnownVaults(vaults)
    }
    loadVaults()
  }, [vaultPath])

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

  const renderPinnedNotebookItem = (notebook: Notebook) => (
    <button
      key={notebook.relativePath}
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
            <FolderOpen size={16} className="text-brand" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[13px] font-semibold text-textMain truncate leading-tight">
              {vaultName}
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
                return (
                  <button
                    key={vault.path}
                    onClick={() => {
                      setIsVaultDropdownOpen(false)
                      if (!isActive) {
                        onSwitchVault(vault.path)
                      }
                    }}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors group',
                      isActive ? 'bg-brand/10' : 'hover:bg-surfaceHighlight/50'
                    )}
                  >
                    <FolderOpen
                      size={16}
                      className={
                        isActive
                          ? 'text-brand shrink-0'
                          : 'text-textMuted shrink-0'
                      }
                    />
                    <span className="text-[13px] text-textMain truncate flex-1">
                      {vault.name}
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
                  onOpenSettings('storage')
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
        {pinnedNotebooks.length > 0 && (
          <div className="mb-3">
            <div className="px-2 pb-2 flex items-center justify-between group mb-1">
              <h3 className="text-[10px] font-bold text-textMuted/60 uppercase tracking-widest group-hover:text-textMuted transition-colors">
                Pinned
              </h3>
            </div>
            <div className="flex flex-col gap-0.5">
              {pinnedNotebooks.map(renderPinnedNotebookItem)}
            </div>
            <div className="my-3 border-b border-border/30 mx-2" />
          </div>
        )}

        <div>
          <div className="px-2 pb-2 flex items-center justify-between group mb-1">
            <h3 className="text-[10px] font-bold text-textMuted/60 uppercase tracking-widest group-hover:text-textMuted transition-colors">
              Notebooks
            </h3>
            <button
              onClick={onCreateNotebook}
              className="text-textMuted hover:text-textMain opacity-0 group-hover:opacity-100 transition-all p-1 rounded hover:bg-surfaceHighlight"
              title="Create Notebook"
            >
              <Plus size={14} strokeWidth={3} />
            </button>
          </div>

          <div className="flex flex-col gap-0.5">
            {notebooks.map((notebook) => (
              <NotebookTreeItem
                key={notebook.relativePath}
                notebook={notebook}
                activeNotebook={activeNotebook}
                onSelectNotebook={onSelectNotebook}
                onCreateSubnotebook={onCreateSubnotebook}
                onContextMenu={onContextMenu}
                onTogglePin={onTogglePin}
                expandedPaths={expandedPaths}
                onToggleExpand={handleToggleExpand}
                depth={0}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="px-3 py-3 border-t border-border/30">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-textMuted hover:text-textMain hover:bg-surfaceHighlight/50 transition-colors group"
        >
          <Settings
            size={16}
            className="text-textMuted/60 group-hover:text-textMuted"
          />
          <span className="text-[13px] font-medium">Settings</span>
        </button>
      </div>
    </div>
  )
}
