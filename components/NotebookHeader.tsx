import { PanelLeft, PanelLeftClose, ChevronRight, FolderOpen } from 'lucide-react'

interface NotebookHeaderProps {
  notebookPath?: string
  noteCount?: number
  isSidebarCollapsed: boolean
  onToggleSidebar: () => void
  onOpenInExplorer?: () => void
}

export function NotebookHeader({
  notebookPath,
  noteCount = 0,
  isSidebarCollapsed,
  onToggleSidebar,
  onOpenInExplorer
}: NotebookHeaderProps) {
  const pathParts = notebookPath?.split('/').filter(Boolean) || []

  return (
    <div className="h-14 border-b border-border/40 flex items-center px-4 justify-between bg-glass backdrop-blur-md z-20 absolute top-0 left-0 right-0">
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

        <div className="h-6 w-px bg-border/30 shrink-0" />

        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          {pathParts.map((part, index) => (
            <div key={index} className="flex items-center gap-1.5 min-w-0">
              {index === pathParts.length - 1 ? (
                <span className="font-semibold text-textMain text-[14px] tracking-tight truncate">
                  {part}
                </span>
              ) : (
                <>
                  <span className="text-[13px] text-textMuted/50 truncate max-w-[120px]">
                    {part}
                  </span>
                  <ChevronRight size={12} className="text-textMuted/30 shrink-0" />
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] text-textMuted/40">
          {noteCount === 0 ? 'No notes' : `${noteCount} ${noteCount === 1 ? 'note' : 'notes'}`}
        </span>
        {onOpenInExplorer && (
          <button
            onClick={onOpenInExplorer}
            className="p-2 rounded-lg transition-colors text-textMuted/50 hover:text-textMain hover:bg-surfaceHighlight/50"
            title="Open in file explorer"
          >
            <FolderOpen size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

