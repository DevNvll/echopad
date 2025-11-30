import { Pin, FolderOpen } from 'lucide-react'
import { Notebook } from '../../types'

interface PinnedNotebooksProps {
  notebooks: Notebook[]
  onNotebookClick: (notebookPath: string) => void
}

export function PinnedNotebooks({ notebooks, onNotebookClick }: PinnedNotebooksProps) {
  return (
    <div className="rounded-xl border border-border/50 bg-surface/30 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Pin size={14} className="text-amber-400/70" />
        <h2 className="text-sm font-medium text-textMain">Pinned</h2>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {notebooks.map((notebook) => (
          <button
            key={notebook.relativePath}
            onClick={() => onNotebookClick(notebook.relativePath)}
            className="flex items-center gap-2.5 p-3 rounded-lg bg-surfaceHighlight/30 hover:bg-surfaceHighlight/60 border border-transparent hover:border-amber-500/20 transition-all group text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
              <FolderOpen size={14} className="text-amber-400/80" />
            </div>
            <span className="text-sm text-textMain/80 group-hover:text-textMain truncate">
              {notebook.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}


