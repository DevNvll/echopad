import { Hash, PanelLeft, PanelLeftClose } from 'lucide-react'

interface NotebookHeaderProps {
  notebookName?: string
  isSidebarCollapsed: boolean
  onToggleSidebar: () => void
}

export function NotebookHeader({
  notebookName,
  isSidebarCollapsed,
  onToggleSidebar
}: NotebookHeaderProps) {
  return (
    <div className="h-16 border-b border-border/40 flex items-center pl-4 pr-8 justify-between bg-glass backdrop-blur-md z-20 absolute top-0 left-0 right-0">
      <div className="flex items-center gap-2 overflow-hidden">
        <button
          onClick={onToggleSidebar}
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
          {notebookName}
        </span>
      </div>
    </div>
  )
}

