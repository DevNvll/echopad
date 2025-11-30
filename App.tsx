import { useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Note, Notebook } from './types'
import {
  getSetting,
  openNotebookInExplorer,
  saveVaultIcon,
  saveVaultAccentColor
} from './api'
import { Sidebar } from './components/Sidebar'
import { InputArea } from './components/InputArea'
import { MessageList } from './components/MessageList'
import { NoNotebookSelected } from './components/NoNotebookSelected'
import {
  CreateNotebookModal,
  EditNotebookModal,
  DeleteNotebookModal
} from './components/modals'
import { ContextMenu, ContextMenuAction } from './components/ContextMenu'
import { CommandPalette } from './components/command-palette'
import { SettingsModal } from './components/SettingsModal'
import {
  Trash2,
  Edit2,
  Copy,
  FolderOpen,
  FolderPlus,
  PanelLeft
} from 'lucide-react'
import { clsx } from 'clsx'
import { TitleBar } from './components/TitleBar'
import { SplashScreen } from './components/SplashScreen'
import { ThemeProvider } from './contexts/ThemeContext'
import { VaultSetup } from './components/VaultSetup'
import { NotebookHeader } from './components/NotebookHeader'
import { useSidebarResize, useKeyboardShortcuts } from './hooks'
import {
  useVaultStore,
  useNotebookStore,
  useNotesStore,
  useTagsStore,
  useUIStore
} from './stores'

function App() {
  const {
    vaultPath,
    isVaultSetupOpen,
    appSettings,
    isInitialized,
    initialize,
    selectVault
  } = useVaultStore()

  const {
    notebooks,
    activeNotebook,
    isLoaded: isNotebooksLoaded,
    loadNotebooks,
    selectNotebook,
    currentNotebook,
    restoreLastActiveNotebook
  } = useNotebookStore()

  const { notes, loadNotes, clearNotes, setEditing, deleteNote } =
    useNotesStore()

  const { isLoaded: isTagsLoaded, loadTags, removeNoteTags } = useTagsStore()

  const {
    isCommandOpen,
    isSettingsOpen,
    contextMenu,
    openCommand,
    toggleCommand,
    toggleSettings,
    openSettings,
    closeContextMenu,
    openCreateModal,
    openEditModal,
    openDeleteModal
  } = useUIStore()

  const {
    sidebarWidth,
    setSidebarWidth,
    isResizing,
    startResizing,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    toggleSidebar
  } = useSidebarResize()

  useKeyboardShortcuts({
    isCommandOpen,
    isSettingsOpen,
    onToggleCommand: toggleCommand,
    onToggleSettings: toggleSettings,
    onOpenSettings: useCallback(() => openSettings('general'), [openSettings])
  })

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (!vaultPath) return

    const loadData = async () => {
      await loadNotebooks(vaultPath)
      await loadTags(vaultPath)
      const savedWidth = await getSetting<number>('sidebarWidth', 260)
      setSidebarWidth(savedWidth)
      const collapsed = await getSetting<boolean>('sidebarCollapsed', false)
      setIsSidebarCollapsed(collapsed)
      await restoreLastActiveNotebook()
    }
    loadData()
  }, [
    vaultPath,
    loadNotebooks,
    loadTags,
    setSidebarWidth,
    setIsSidebarCollapsed,
    restoreLastActiveNotebook
  ])

  useEffect(() => {
    if (isNotebooksLoaded && notebooks.length > 0 && !activeNotebook) {
      selectNotebook(notebooks[0].relativePath)
    }
  }, [notebooks, activeNotebook, isNotebooksLoaded, selectNotebook])

  useEffect(() => {
    if (!vaultPath || !activeNotebook) {
      clearNotes()
      return
    }
    loadNotes(vaultPath, activeNotebook)
  }, [vaultPath, activeNotebook, loadNotes, clearNotes])

  const handleSelectVault = async (): Promise<string | null> => {
    const selected = await invoke('open', {
      directory: true,
      multiple: false,
      title: 'Select Vault Folder'
    })

    if (selected && typeof selected === 'string') {
      return selected
    }
    return null
  }

  const handleConfirmVault = async (
    path: string,
    icon: string,
    accentColor: string
  ) => {
    await saveVaultIcon(path, icon)
    await saveVaultAccentColor(path, accentColor)
    await selectVault(path)
  }

  const handleDeleteMessage = async (filename: string) => {
    if (!vaultPath || !activeNotebook) return
    await removeNoteTags(filename, activeNotebook)
    await deleteNote(vaultPath, activeNotebook, filename)
  }

  const handleContextMenuAction = (action: ContextMenuAction) => {
    if (!contextMenu) return

    if (contextMenu.type === 'notebook') {
      const notebook = contextMenu.data as Notebook
      if (!notebook) return

      if (action === 'edit') {
        openEditModal(notebook)
      } else if (action === 'delete') {
        openDeleteModal(notebook)
      } else if (action === 'create-sub') {
        openCreateModal(notebook)
      } else if (action === 'open-in-explorer') {
        openNotebookInExplorer(notebook.path)
      }
    } else if (contextMenu.type === 'message') {
      const note = contextMenu.data as Note
      if (action === 'edit') {
        setEditing(note.filename)
      } else if (action === 'delete') {
        handleDeleteMessage(note.filename)
      } else if (action === 'copy') {
        navigator.clipboard.writeText(note.content)
      }
    }
    closeContextMenu()
  }

  const notebook = currentNotebook()

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
      <VaultSetup
        appSettings={appSettings}
        onSelectVault={handleSelectVault}
        onConfirmVault={handleConfirmVault}
        onOpenCommandPalette={() => openCommand()}
      />
    )
  }

  return (
    <ThemeProvider initialSettings={appSettings} vaultPath={vaultPath}>
      <div className="h-screen w-screen bg-transparent font-sans text-textMain">
        <div
          className="flex flex-col h-full w-full overflow-hidden rounded-lg border border-border/50 bg-background"
          onClick={closeContextMenu}
        >
          <TitleBar onOpenCommandPalette={() => openCommand()} />
          <div className="flex flex-1 min-h-0">
            {!isSidebarCollapsed && (
              <>
                <Sidebar width={sidebarWidth} />

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
              {activeNotebook ? (
                <>
                  <NotebookHeader
                    notebookName={notebook?.name}
                    notebookPath={activeNotebook || undefined}
                    noteCount={notes.length}
                    isSidebarCollapsed={isSidebarCollapsed}
                    onToggleSidebar={toggleSidebar}
                    onOpenInExplorer={
                      notebook
                        ? () => openNotebookInExplorer(notebook.path)
                        : undefined
                    }
                  />

                  <div className="flex-1 flex flex-row min-h-0 pt-16 relative bg-[#050505]">
                    <div className="flex-1 flex flex-col min-w-0 z-0">
                      <MessageList />
                      <InputArea />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col min-h-0 bg-[#050505]">
                  <div className="h-16 border-b border-border/40 flex items-center pl-4 pr-8 bg-glass backdrop-blur-md">
                    {isSidebarCollapsed && (
                      <button
                        onClick={toggleSidebar}
                        className="p-2 rounded-md text-textMuted/60 hover:text-textMain hover:bg-surfaceHighlight/50 transition-colors"
                        title="Show sidebar"
                      >
                        <PanelLeft size={18} />
                      </button>
                    )}
                  </div>
                  <NoNotebookSelected
                    hasNotebooks={notebooks.length > 0}
                    onCreateNotebook={() => openCreateModal()}
                  />
                </div>
              )}
            </div>

            <CommandPalette />
            <SettingsModal />

            {contextMenu && (
              <ContextMenu
                x={contextMenu.x}
                y={contextMenu.y}
                onClose={closeContextMenu}
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
                          label: 'Open in Explorer',
                          action: 'open-in-explorer',
                          icon: <FolderOpen size={12} />
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

            <CreateNotebookModal />
            <EditNotebookModal />
            <DeleteNotebookModal />
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}

export default App
