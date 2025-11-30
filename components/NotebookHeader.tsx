import { Hash, PanelLeft, PanelLeftClose, ChevronRight, FolderOpen } from 'lucide-react'

interface NotebookHeaderProps {
  notebookName?: string
  notebookPath?: string
  noteCount?: number
  isSidebarCollapsed: boolean
  onToggleSidebar: () => void
  onOpenInExplorer?: () => void
}

export function NotebookHeader({
  notebookName,
  notebookPath,
  noteCount = 0,
  isSidebarCollapsed,
  onToggleSidebar,
  onOpenInExplorer
}: NotebookHeaderProps) {
  const pathParts = notebookPath?.split('/').filter(Boolean) || []
  const isNested = pathParts.length > 1

  return (
    <div className="h-16 border-b border-border/40 flex items-center px-4 justify-between bg-glass backdrop-blur-md z-20 absolute top-0 left-0 right-0">
      <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-textMuted/60 hover:text-textMain hover:bg-surfaceHighlight/50 transition-colors shrink-0"
          title={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
          {isSidebarCollapsed ? (
            <PanelLeft size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
        </button>

        <div className="h-8 w-px bg-border/30 shrink-0" />

        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          {isNested ? (
            <div className="flex items-center gap-1.5 min-w-0">
              {pathParts.slice(0, -1).map((part, index) => (
                <div key={index} className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[13px] text-textMuted/40 truncate max-w-[120px]">
                    {part}
                  </span>
                  <ChevronRight size={12} className="text-textMuted/25 shrink-0" />
                </div>
              ))}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
                  <Hash size={14} className="text-brand" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-textMain text-[15px] tracking-tight leading-tight truncate">
                    {notebookName}
                  </span>
                  <span className="text-[10px] text-textMuted/50">
                    {noteCount === 0 ? 'No notes' : `${noteCount} ${noteCount === 1 ? 'note' : 'notes'}`}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
                <Hash size={16} className="text-brand" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-textMain text-[15px] tracking-tight leading-tight truncate">
                  {notebookName}
                </span>
                <span className="text-[11px] text-textMuted/60">
                  {noteCount === 0 ? 'No notes yet' : `${noteCount} ${noteCount === 1 ? 'note' : 'notes'}`}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {onOpenInExplorer && (
        <button
          onClick={onOpenInExplorer}
          className="p-2 rounded-lg transition-colors shrink-0 text-textMuted/50 hover:text-textMain hover:bg-surfaceHighlight/50"
          title="Open in file explorer"
        >
          <FolderOpen size={16} />
        </button>
      )}
    </div>
  )
}

