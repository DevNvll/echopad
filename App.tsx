import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { Notebook, Note, AppSettings } from './types'
import { extractTags, extractUrls } from './utils/formatting'
import {
  getVaultPath,
  setVaultPath,
  getSetting,
  saveSetting,
  listNotebooks,
  createNotebook,
  renameNotebook,
  deleteNotebook,
  listNotes,
  readNote,
  createNote,
  updateNote,
  deleteNote,
  toggleNotebookPin,
  searchNotes,
  syncVaultTags,
  syncNoteTags,
  removeNoteTags,
  getAllTags,
  TagWithCount,
  getAppSettings,
  addKnownVault,
  getVaultAccentColor
} from './api'
import { Sidebar } from './components/Sidebar'
import { InputArea } from './components/InputArea'
import { MessageList } from './components/MessageList'
import {
  CreateNotebookModal,
  EditNotebookModal,
  DeleteNotebookModal
} from './components/modals'
import { ContextMenu, ContextMenuAction } from './components/ContextMenu'
import { CommandPalette } from './components/command-palette'
import { SettingsModal, SettingsSection } from './components/SettingsModal'
import {
  Hash,
  Trash2,
  Edit2,
  Copy,
  FolderOpen,
  FolderPlus,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react'
import { clsx } from 'clsx'
import { TitleBar } from './components/TitleBar'
import { SplashScreen } from './components/SplashScreen'
import { ThemeProvider } from './contexts/ThemeContext'

function App() {
  const [vaultPath, setVaultPathState] = useState<string | null>(null)
  const [isVaultSetupOpen, setIsVaultSetupOpen] = useState(false)
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [activeNotebook, setActiveNotebook] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoadingNotes, setIsLoadingNotes] = useState(false)
  const [isCommandOpen, setIsCommandOpen] = useState(false)
  const [targetMessageId, setTargetMessageId] = useState<string | null>(null)
  const [allTags, setAllTags] = useState<TagWithCount[]>([])
  const [commandInitialSearch, setCommandInitialSearch] = useState('')

  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [isResizing, setIsResizing] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isNotebooksLoaded, setIsNotebooksLoaded] = useState(false)
  const [isTagsLoaded, setIsTagsLoaded] = useState(false)

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [targetNotebook, setTargetNotebook] = useState<Notebook | null>(null)
  const [parentNotebook, setParentNotebook] = useState<Notebook | null>(null)

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>('general')
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null)

  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    type: 'notebook' | 'message'
    data: Notebook | Note
  } | null>(null)

  useEffect(() => {
    const loadSettings = async () => {
      const vault = await getVaultPath()
      const globalSettings = await getAppSettings()

      let accentColor = globalSettings.accentColor
      if (vault) {
        const vaultColor = await getVaultAccentColor(vault)
        if (vaultColor) {
          accentColor = vaultColor
        }
      }

      const settings = { ...globalSettings, accentColor }
      setAppSettings(settings)

      document.documentElement.style.setProperty('--accent-color', accentColor)

      if (vault) {
        setVaultPathState(vault)
        await addKnownVault(vault)
        const savedWidth = await getSetting<number>('sidebarWidth', 260)
        setSidebarWidth(savedWidth)
        const collapsed = await getSetting<boolean>('sidebarCollapsed', false)
        setIsSidebarCollapsed(collapsed)
        const lastNotebook = await getSetting<string | null>(
          'lastActiveNotebook',
          null
        )
        if (lastNotebook) {
          setActiveNotebook(lastNotebook)
        }
      } else {
        setIsVaultSetupOpen(true)
      }
      setIsInitialized(true)
    }
    loadSettings()
  }, [])

  useEffect(() => {
    if (!vaultPath) return

    const loadNotebooks = async () => {
      const nbs = await listNotebooks(vaultPath)
      setNotebooks(nbs)
      setIsNotebooksLoaded(true)
    }
    loadNotebooks()
  }, [vaultPath])

  useEffect(() => {
    if (!vaultPath) return

    const loadTags = async () => {
      await syncVaultTags(vaultPath)
      const tags = await getAllTags()
      setAllTags(tags)
      setIsTagsLoaded(true)
    }
    loadTags()
  }, [vaultPath])

  const flattenNotebooks = useCallback((nbs: Notebook[]): Notebook[] => {
    const result: Notebook[] = []
    for (const nb of nbs) {
      result.push(nb)
      if (nb.children) {
        result.push(...flattenNotebooks(nb.children))
      }
    }
    return result
  }, [])

  const allNotebooks = useMemo(
    () => flattenNotebooks(notebooks),
    [notebooks, flattenNotebooks]
  )

  useEffect(() => {
    if (isInitialized && notebooks.length > 0 && !activeNotebook) {
      const defaultNb = notebooks[0].relativePath
      setActiveNotebook(defaultNb)
      saveSetting('lastActiveNotebook', defaultNb)
    }
  }, [notebooks, activeNotebook, isInitialized])

  useEffect(() => {
    if (!vaultPath || !activeNotebook) {
      setNotes([])
      return
    }

    const loadNotes = async () => {
      setIsLoadingNotes(true)
      try {
        const metadata = await listNotes(vaultPath, activeNotebook)
        const loadedNotes: Note[] = []
        for (const meta of metadata) {
          const note = await readNote(vaultPath, activeNotebook, meta.filename)
          loadedNotes.push(note)
        }
        setNotes(loadedNotes)
      } catch (err) {
        console.error('Failed to load notes:', err)
        setNotes([])
      } finally {
        setIsLoadingNotes(false)
      }
    }
    loadNotes()
  }, [vaultPath, activeNotebook])

  const notebookMap = useMemo(() => {
    return allNotebooks.reduce((acc, nb) => {
      acc[nb.relativePath] = nb.name
      return acc
    }, {} as Record<string, string>)
  }, [allNotebooks])

  const handleSelectVault = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select Vault Folder'
    })

    if (selected && typeof selected === 'string') {
      await setVaultPath(selected)
      setVaultPathState(selected)
      setIsVaultSetupOpen(false)
    }
  }

  const handleSelectNotebook = (relativePath: string) => {
    setActiveNotebook(relativePath)
    setTargetMessageId(null)
    saveSetting('lastActiveNotebook', relativePath)
  }

  const startResizing = useCallback(() => {
    setIsResizing(true)
  }, [])

  const widthRef = React.useRef(sidebarWidth)
  useEffect(() => {
    widthRef.current = sidebarWidth
  }, [sidebarWidth])

  const stopResizingWrapper = useCallback(() => {
    setIsResizing(false)
    saveSetting('sidebarWidth', widthRef.current)
  }, [])

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        const newWidth = mouseMoveEvent.clientX
        if (newWidth >= 200 && newWidth <= 480) {
          setSidebarWidth(newWidth)
        }
      }
    },
    [isResizing]
  )

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const newValue = !prev
      saveSetting('sidebarCollapsed', newValue)
      return newValue
    })
  }, [])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize)
      window.addEventListener('mouseup', stopResizingWrapper)
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
    } else {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizingWrapper)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    return () => {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizingWrapper)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isResizing, resize, stopResizingWrapper])

  const handleSendMessage = async (content: string) => {
    if (!vaultPath || !activeNotebook) return
    setTargetMessageId(null)

    const newNote = await createNote(vaultPath, activeNotebook, content)
    setNotes((prev) => [...prev, newNote])

    await syncNoteTags(newNote)
    const tags = await getAllTags()
    setAllTags(tags)
  }

  const handleEditMessage = useCallback(
    async (filename: string, newContent: string) => {
      if (!vaultPath || !activeNotebook) return

      const updated = await updateNote(
        vaultPath,
        activeNotebook,
        filename,
        newContent
      )
      setNotes((prev) =>
        prev.map((n) => (n.filename === filename ? updated : n))
      )
      setEditingMessageId(null)

      await syncNoteTags(updated)
      const tags = await getAllTags()
      setAllTags(tags)
    },
    [vaultPath, activeNotebook]
  )

  const handleDeleteMessage = async (filename: string) => {
    if (!vaultPath || !activeNotebook) return

    await removeNoteTags(filename, activeNotebook)
    await deleteNote(vaultPath, activeNotebook, filename)
    setNotes((prev) => prev.filter((n) => n.filename !== filename))

    const tags = await getAllTags()
    setAllTags(tags)
  }

  const handleCreateNotebook = async (name: string) => {
    if (!vaultPath || !name.trim()) return

    const formattedName = name.trim().toLowerCase().replace(/\s+/g, '-')
    const parentPath = parentNotebook?.relativePath
    const nb = await createNotebook(vaultPath, formattedName, parentPath)

    const reloadNotebooks = async () => {
      const nbs = await listNotebooks(vaultPath)
      setNotebooks(nbs)
    }
    await reloadNotebooks()

    setIsCreateModalOpen(false)
    setParentNotebook(null)
    handleSelectNotebook(nb.relativePath)
  }

  const handleUpdateNotebook = async (name: string) => {
    if (!vaultPath || !targetNotebook || !name.trim()) return

    const newName = name.trim().toLowerCase().replace(/\s+/g, '-')
    const updated = await renameNotebook(
      vaultPath,
      targetNotebook.relativePath,
      newName
    )

    const reloadNotebooks = async () => {
      const nbs = await listNotebooks(vaultPath)
      setNotebooks(nbs)
    }
    await reloadNotebooks()

    if (activeNotebook === targetNotebook.relativePath) {
      setActiveNotebook(updated.relativePath)
      saveSetting('lastActiveNotebook', updated.relativePath)
    }
    setIsEditModalOpen(false)
    setTargetNotebook(null)
  }

  const handleDeleteNotebook = async () => {
    if (!vaultPath || !targetNotebook) return

    await deleteNotebook(vaultPath, targetNotebook.relativePath)

    const reloadNotebooks = async () => {
      const nbs = await listNotebooks(vaultPath)
      setNotebooks(nbs)
    }
    await reloadNotebooks()

    setIsDeleteModalOpen(false)
    setTargetNotebook(null)

    if (activeNotebook === targetNotebook.relativePath) {
      const remaining = allNotebooks.find(
        (nb) => nb.relativePath !== targetNotebook.relativePath
      )
      const newActive = remaining?.relativePath || null
      setActiveNotebook(newActive)
      if (newActive) saveSetting('lastActiveNotebook', newActive)
    }
  }

  const updateNotebookInTree = useCallback(
    (
      nbs: Notebook[],
      targetPath: string,
      updater: (nb: Notebook) => Notebook
    ): Notebook[] => {
      return nbs.map((nb) => {
        if (nb.relativePath === targetPath) {
          return updater(nb)
        }
        if (nb.children) {
          return {
            ...nb,
            children: updateNotebookInTree(nb.children, targetPath, updater)
          }
        }
        return nb
      })
    },
    []
  )

  const handleTogglePin = async (notebook: Notebook) => {
    const isPinned = await toggleNotebookPin(notebook.relativePath)
    setNotebooks((prev) =>
      updateNotebookInTree(prev, notebook.relativePath, (nb) => ({
        ...nb,
        isPinned
      }))
    )
  }

  const onNotebookContextMenu = (e: React.MouseEvent, notebook: Notebook) => {
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'notebook',
      data: notebook
    })
  }

  const onMessageContextMenu = useCallback(
    (e: React.MouseEvent, note: Note) => {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type: 'message',
        data: note
      })
    },
    []
  )

  const handleEditCancel = useCallback(() => {
    setEditingMessageId(null)
  }, [])

  const handleContextMenuAction = (action: ContextMenuAction) => {
    if (!contextMenu) return

    if (contextMenu.type === 'notebook') {
      const notebook = contextMenu.data as Notebook
      if (action === 'edit') {
        setTargetNotebook(notebook)
        setIsEditModalOpen(true)
      } else if (action === 'delete') {
        setTargetNotebook(notebook)
        setIsDeleteModalOpen(true)
      } else if (action === 'create-sub') {
        setParentNotebook(notebook)
        setIsCreateModalOpen(true)
      }
    } else if (contextMenu.type === 'message') {
      const note = contextMenu.data as Note
      if (action === 'edit') {
        setEditingMessageId(note.filename)
      } else if (action === 'delete') {
        handleDeleteMessage(note.filename)
      } else if (action === 'copy') {
        navigator.clipboard.writeText(note.content)
      }
    }
    setContextMenu(null)
  }

  const handleSearchResultClick = async (note: Note) => {
    if (note.notebookName) {
      setTargetMessageId(note.filename)
      handleSelectNotebook(note.notebookName)
    }
  }

  const handleTagClick = useCallback((tag: string) => {
    setCommandInitialSearch(`#${tag}`)
    setIsCommandOpen(true)
  }, [])

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const handleCopyContent = useCallback((content: string) => {
    navigator.clipboard.writeText(content)
  }, [])

  const handleOpenSettings = useCallback((section?: SettingsSection) => {
    setSettingsSection('general')
    setIsSettingsOpen(true)
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (!isSettingsOpen) {
          setSettingsSection('general')
        }
        setIsSettingsOpen((prev) => !prev)
        return
      }
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        if (isCommandOpen && e.ctrlKey && !e.metaKey) {
          return
        }
        e.preventDefault()
        setIsCommandOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [isCommandOpen])

  const currentNotebook = allNotebooks.find(
    (nb) => nb.relativePath === activeNotebook
  )

  const isFullyLoaded =
    isInitialized &&
    appSettings &&
    (!vaultPath || (isNotebooksLoaded && isTagsLoaded))

  if (!isFullyLoaded || !appSettings) {
    return (
      <SplashScreen
        isVisible={true}
        appName={appSettings?.appName}
        accentColor={appSettings?.accentColor}
      />
    )
  }

  if (isVaultSetupOpen || !vaultPath) {
    return (
      <ThemeProvider initialSettings={appSettings} vaultPath={null}>
        <div className="h-screen w-screen bg-transparent font-sans text-textMain">
          <div className="flex flex-col h-full w-full overflow-hidden rounded-lg border border-border/50 bg-background">
            <TitleBar onOpenCommandPalette={() => setIsCommandOpen(true)} />
            <div className="flex-1 flex items-center justify-center">
              <div className="max-w-md w-full mx-4 bg-surface border border-border rounded-2xl p-8 shadow-2xl">
                <div className="flex flex-col items-center text-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-brand/20 to-brand/5 border border-brand/20 flex items-center justify-center">
                    <FolderOpen className="w-8 h-8 text-brand" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold mb-2">
                      Welcome to {appSettings.appName}
                    </h1>
                    <p className="text-textMuted text-sm">
                      To get started, select or create a folder where your notes
                      will be stored. This will be your vault - all notebooks
                      and notes will live here.
                    </p>
                  </div>
                  <button
                    onClick={handleSelectVault}
                    className="w-full bg-brand hover:bg-brand/90 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                  >
                    Select Vault Folder
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider initialSettings={appSettings} vaultPath={vaultPath}>
      <div className="h-screen w-screen bg-transparent font-sans text-textMain">
        <div
          className="flex flex-col h-full w-full overflow-hidden rounded-lg border border-border/50 bg-background"
          onClick={() => setContextMenu(null)}
        >
          <TitleBar onOpenCommandPalette={() => setIsCommandOpen(true)} />
          <div className="flex flex-1 min-h-0">
            {!isSidebarCollapsed && (
              <>
                <Sidebar
                  notebooks={notebooks}
                  activeNotebook={activeNotebook}
                  onSelectNotebook={handleSelectNotebook}
                  onCreateNotebook={() => {
                    setParentNotebook(null)
                    setIsCreateModalOpen(true)
                  }}
                  onCreateSubnotebook={(parent) => {
                    setParentNotebook(parent)
                    setIsCreateModalOpen(true)
                  }}
                  onContextMenu={onNotebookContextMenu}
                  onTogglePin={handleTogglePin}
                  width={sidebarWidth}
                  vaultPath={vaultPath}
                  onOpenSettings={handleOpenSettings}
                  onSwitchVault={async (path) => {
                    await setVaultPath(path)
                    setVaultPathState(path)
                    window.location.reload()
                  }}
                />

                <div
                  className={clsx(
                    'w-1 hover:w-1.5 -ml-0.5 hover:-ml-0.75 z-30 cursor-col-resize flex flex-col justify-center items-center transition-all group select-none',
                    isResizing ? 'bg-brand/50 w-1.5' : 'hover:bg-brand/50'
                  )}
                  onMouseDown={startResizing}
                ></div>
              </>
            )}

            <div className="flex-1 flex flex-col min-w-0 bg-background relative shadow-2xl">
              <div className="h-16 border-b border-border/40 flex items-center pl-4 pr-8 justify-between bg-glass backdrop-blur-md z-20 absolute top-0 left-0 right-0">
                <div className="flex items-center gap-2 overflow-hidden">
                  <button
                    onClick={toggleSidebar}
                    className="p-2 rounded-md text-textMuted/60 hover:text-textMain hover:bg-surfaceHighlight/50 transition-colors"
                    title={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
                  >
                    {isSidebarCollapsed ? (
                      <PanelLeft size={18} />
                    ) : (
                      <PanelLeftClose size={18} />
                    )}
                  </button>
                  <Hash className="text-textMuted/50" size={20} />
                  <span className="font-bold text-textMain text-base tracking-tight leading-none">
                    {currentNotebook?.name}
                  </span>
                </div>
              </div>

              <div className="flex-1 flex flex-row min-h-0 pt-16 relative bg-[#050505]">
                <div className="flex-1 flex flex-col min-w-0 z-0">
                  <MessageList
                    notes={notes}
                    isLoading={isLoadingNotes}
                    targetMessageId={targetMessageId}
                    notebooks={notebookMap}
                    onContextMenu={onMessageContextMenu}
                    editingMessageId={editingMessageId}
                    onEditSubmit={handleEditMessage}
                    onEditCancel={handleEditCancel}
                    vaultPath={vaultPath}
                    onTagClick={handleTagClick}
                    onEditStart={setEditingMessageId}
                    onCopy={handleCopyContent}
                    onDelete={handleDeleteMessage}
                    onScroll={handleCloseContextMenu}
                  />
                  <InputArea
                    channelName={currentNotebook?.name || 'unknown'}
                    onSendMessage={handleSendMessage}
                    vaultPath={vaultPath}
                  />
                </div>
              </div>
            </div>

            <CommandPalette
              isOpen={isCommandOpen}
              setIsOpen={(open) => {
                setIsCommandOpen(open)
                if (!open) setCommandInitialSearch('')
              }}
              notebooks={notebooks}
              vaultPath={vaultPath}
              onSelectNotebook={handleSelectNotebook}
              onSelectMessage={handleSearchResultClick}
              onCreateNotebook={() => {
                setParentNotebook(null)
                setIsCreateModalOpen(true)
              }}
              onOpenSettings={handleOpenSettings}
              allTags={allTags}
              initialSearch={commandInitialSearch}
            />

            <SettingsModal
              isOpen={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
              vaultPath={vaultPath}
              onAddVault={handleSelectVault}
              onSwitchVault={async (path) => {
                await setVaultPath(path)
                setVaultPathState(path)
                window.location.reload()
              }}
              initialSection={settingsSection}
            />

            {contextMenu && (
              <ContextMenu
                x={contextMenu.x}
                y={contextMenu.y}
                onClose={() => setContextMenu(null)}
                onSelect={handleContextMenuAction}
                items={
                  contextMenu.type === 'notebook'
                    ? [
                        {
                          label: 'Create Subnotebook',
                          action: 'create-sub',
                          icon: <FolderPlus size={12} />
                        },
                        {
                          label: 'Edit Notebook',
                          action: 'edit',
                          icon: <Edit2 size={12} />
                        },
                        {
                          label: 'Delete Notebook',
                          action: 'delete',
                          icon: <Trash2 size={12} />,
                          destructive: true
                        }
                      ]
                    : [
                        {
                          label: 'Edit Note',
                          action: 'edit',
                          icon: <Edit2 size={12} />
                        },
                        {
                          label: 'Copy Text',
                          action: 'copy',
                          icon: <Copy size={12} />
                        },
                        {
                          label: 'Delete Note',
                          action: 'delete',
                          icon: <Trash2 size={12} />,
                          destructive: true
                        }
                      ]
                }
              />
            )}

            <CreateNotebookModal
              isOpen={isCreateModalOpen}
              onClose={() => {
                setIsCreateModalOpen(false)
                setParentNotebook(null)
              }}
              onSubmit={handleCreateNotebook}
              parentNotebook={parentNotebook}
            />

            <EditNotebookModal
              isOpen={isEditModalOpen}
              onClose={() => {
                setIsEditModalOpen(false)
                setTargetNotebook(null)
              }}
              onSubmit={handleUpdateNotebook}
              notebook={targetNotebook}
            />

            <DeleteNotebookModal
              isOpen={isDeleteModalOpen}
              onClose={() => {
                setIsDeleteModalOpen(false)
                setTargetNotebook(null)
              }}
              onSubmit={handleDeleteNotebook}
              notebook={targetNotebook}
            />
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}

export default App
