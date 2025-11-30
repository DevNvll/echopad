import { useEffect } from 'react'
import { PanelLeft, Plus, Command } from 'lucide-react'
import { StatsBar } from './dashboard/StatsBar'
import { RecentNotes } from './dashboard/RecentNotes'
import { PinnedNotebooks } from './dashboard/PinnedNotebooks'
import { TagCloud } from './dashboard/TagCloud'
import { useVaultStore, useNotebookStore, useNotesStore, useTagsStore } from '../stores'

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
  const { recentNotes, totalNotesCount, loadRecentNotes, loadTotalNotesCount } = useNotesStore()
  const { allTags } = useTagsStore()

  useEffect(() => {
    if (vaultPath) {
      loadRecentNotes(vaultPath)
      loadTotalNotesCount(vaultPath)
    }
  }, [vaultPath, loadRecentNotes, loadTotalNotesCount])

  const pinnedNotebooks = allNotebooks().filter((nb) => nb.isPinned)

  const handleNoteClick = (notebookPath: string) => {
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
              {pinnedNotebooks.length > 0 && (
                <PinnedNotebooks
                  notebooks={pinnedNotebooks}
                  onNotebookClick={handleNotebookClick}
                />
              )}

              <TagCloud
                tags={allTags}
                onTagClick={onOpenCommandPalette}
              />
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 pt-4">
            <button
              onClick={onCreateNotebook}
              className="flex items-center gap-2.5 px-5 py-3 bg-brand hover:bg-brand/90 text-white font-semibold rounded-xl transition-colors"
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>New Notebook</span>
            </button>

            <div className="flex items-center gap-1.5 text-[11px] text-textMuted/40">
              <span>Press</span>
              <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded font-mono text-[10px]">
                Ctrl
              </kbd>
              <span>+</span>
              <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded font-mono text-[10px]">
                K
              </kbd>
              <span>for command palette</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

