import { SearchPage } from './search'
import { Dashboard } from './Dashboard'
import { NoNotebookSelected } from './NoNotebookSelected'
import { NotebookHeader } from './NotebookHeader'
import { MessageList } from './MessageList'
import { InputArea } from './InputArea'
import { openNotebookInExplorer } from '../api'
import {
  useRouterStore,
  useNotebookStore,
  useNotesStore,
  useUIStore
} from '../stores'

interface MainContentProps {
  isSidebarCollapsed: boolean
  onToggleSidebar: () => void
  onCreateNotebook: () => void
  onOpenCommandPalette: () => void
}

export function MainContent({
  isSidebarCollapsed,
  onToggleSidebar,
  onCreateNotebook,
  onOpenCommandPalette
}: MainContentProps) {
  const { currentRoute } = useRouterStore()
  const { currentNotebook } = useNotebookStore()
  const { notes } = useNotesStore()

  const notebook = currentNotebook()

  switch (currentRoute.type) {
    case 'search':
      return (
        <SearchPage
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={onToggleSidebar}
        />
      )

    case 'notebook':
      return (
        <>
          <NotebookHeader
            notebookPath={currentRoute.notebookPath}
            noteCount={notes.length}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={onToggleSidebar}
            onOpenInExplorer={
              notebook ? () => openNotebookInExplorer(notebook.path) : undefined
            }
          />
          <div className="flex-1 flex flex-row min-h-0 pt-16 relative bg-[#050505]">
            <div className="flex-1 flex flex-col min-w-0 z-0">
              <MessageList />
              <InputArea />
            </div>
          </div>
        </>
      )

    case 'dashboard':
      return (
        <Dashboard
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={onToggleSidebar}
          onCreateNotebook={onCreateNotebook}
          onOpenCommandPalette={onOpenCommandPalette}
        />
      )

    case 'empty':
      return <NoNotebookSelected onCreateNotebook={onCreateNotebook} />

    default:
      return null
  }
}

