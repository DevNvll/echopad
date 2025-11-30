import { useEffect } from 'react'
import { PanelLeft, Plus } from 'lucide-react'
import { StatsBar } from './dashboard/StatsBar'
import { RecentNotes } from './dashboard/RecentNotes'
import { FavoriteNotes } from './dashboard/FavoriteNotes'
import { PinnedNotebooks } from './dashboard/PinnedNotebooks'
import { TagCloud } from './dashboard/TagCloud'
import { useVaultStore, useNotebookStore, useNotesStore, useTagsStore, useUIStore } from '../stores'

interface DashboardProps {
  isSidebarCollapsed: boolean
  onToggleSidebar: () => void
  onCreateNotebook: () => void
  onOpenCommandPalette: () => void
}

export function Dashboard({
  isSidebarCollapsed,
  onToggleSidebar,
  onCreateNotebook,
  onOpenCommandPalette
}: DashboardProps) {
  const { vaultPath } = useVaultStore()
  const { notebooks, allNotebooks, selectNotebook } = useNotebookStore()
  const { recentNotes, favoriteNotes, totalNotesCount, loadRecentNotes, loadFavoriteNotes, loadTotalNotesCount, setTarget } = useNotesStore()
  const { allTags } = useTagsStore()
  const { openCommand } = useUIStore()

  useEffect(() => {
    if (vaultPath) {
      loadRecentNotes(vaultPath)
      loadFavoriteNotes(vaultPath)
      loadTotalNotesCount(vaultPath)
    }
  }, [vaultPath, loadRecentNotes, loadFavoriteNotes, loadTotalNotesCount])

  const pinnedNotebooks = allNotebooks().filter((nb) => nb.isPinned)

  const handleNoteClick = (notebookPath: string, filename: string) => {
    setTarget(filename)
    selectNotebook(notebookPath)
  }

  const handleNotebookClick = (notebookPath: string) => {
    selectNotebook(notebookPath)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#050505]">
      <div className="h-16 border-b border-border/40 flex items-center px-4 bg-glass backdrop-blur-md justify-between">
        <div className="flex items-center gap-3">
          {isSidebarCollapsed && (
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-md text-textMuted/60 hover:text-textMain hover:bg-surfaceHighlight/50 transition-colors"
              title="Show sidebar"
            >
              <PanelLeft size={18} />
            </button>
          )}
          <h1 className="text-lg font-semibold text-textMain">Dashboard</h1>
        </div>
        <button
          onClick={onCreateNotebook}
          className="flex items-center gap-2 px-3 py-1.5 bg-brand hover:bg-brand/90 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>New Notebook</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-8">
          <StatsBar
            notebooksCount={allNotebooks().length}
            notesCount={totalNotesCount}
            tagsCount={allTags.length}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecentNotes
              notes={recentNotes}
              onNoteClick={handleNoteClick}
            />

            <div className="space-y-6">
              <FavoriteNotes
                notes={favoriteNotes}
                onNoteClick={handleNoteClick}
              />

              {pinnedNotebooks.length > 0 && (
                <PinnedNotebooks
                  notebooks={pinnedNotebooks}
                  onNotebookClick={handleNotebookClick}
                />
              )}

              <TagCloud
                tags={allTags}
                onTagClick={(tag) => openCommand(`#${tag}`)}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

