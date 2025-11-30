import { Plus, Sparkles, BookOpen } from 'lucide-react'

interface NoNotebookSelectedProps {
  onCreateNotebook: () => void
}

export function NoNotebookSelected({
  onCreateNotebook
}: NoNotebookSelectedProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#050505]">
      <div className="h-16 border-b border-border/40 flex items-center pl-4 pr-8 bg-glass backdrop-blur-md" />
      <div className="flex-1 flex flex-col items-center justify-center p-8 select-none">
        <div className="flex flex-col items-center gap-8 max-w-sm text-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-brand/25 via-brand/15 to-brand/5 border border-brand/30 flex items-center justify-center">
              <BookOpen className="text-brand" size={40} strokeWidth={1.5} />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg animate-pulse">
              <Sparkles className="text-white" size={16} />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold text-textMain tracking-tight">
              Create your first notebook
            </h2>
            <p className="text-sm text-textMuted/70 leading-relaxed">
              Notebooks help you organize your thoughts, ideas, and notes into
              separate collections. Get started by creating one.
            </p>
          </div>

          <button
            onClick={onCreateNotebook}
            className="flex items-center gap-2.5 px-5 py-3 bg-brand hover:bg-brand/90 text-white font-semibold rounded-xl transition-colors"
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>Create Notebook</span>
          </button>

          <div className="flex flex-col gap-1.5 mt-2 text-[11px] text-textMuted/40">
            <span>
              or press{' '}
              <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded font-mono text-[10px]">
                Ctrl
              </kbd>{' '}
              +{' '}
              <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded font-mono text-[10px]">
                K
              </kbd>{' '}
              to open command palette
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
