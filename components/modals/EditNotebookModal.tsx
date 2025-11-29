import { useState, useEffect, useCallback } from 'react'
import { Pencil, Folder } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Notebook } from '@/types'

interface EditNotebookModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (name: string) => void
  notebook: Notebook | null
}

export function EditNotebookModal({
  isOpen,
  onClose,
  onSubmit,
  notebook
}: EditNotebookModalProps) {
  const [name, setName] = useState('')

  useEffect(() => {
    if (isOpen && notebook) {
      setName(notebook.name)
    }
  }, [isOpen, notebook])

  const handleSubmit = useCallback(() => {
    if (!name.trim()) return
    onSubmit(name.trim())
  }, [name, onSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && name.trim()) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit, name]
  )

  const hasChanges = name.trim() !== notebook?.name

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-full max-w-md p-0 gap-0 bg-[#0c0c0e] border-border/60 overflow-hidden"
        showCloseButton={false}
      >
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Pencil className="w-5 h-5 text-amber-500" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold text-textMain">
                Edit Notebook
              </DialogTitle>
              <DialogDescription className="text-sm text-textMuted mt-0.5">
                Rename your notebook
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          <div className="flex items-center gap-2 text-sm text-textMuted bg-surfaceHighlight/40 rounded-lg px-3 py-2.5 border border-border/30">
            <Folder size={14} className="text-textMuted/70 shrink-0" />
            <span className="truncate font-medium text-textMain">
              {notebook?.name}
            </span>
            <span className="text-textMuted/50">→</span>
            <span className="truncate text-amber-400 font-medium">
              {name || 'new-name'}
            </span>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-textMuted/80 uppercase tracking-wider">
              New Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-black/40 border-border/50 text-textMain placeholder:text-textMuted/40 focus-visible:border-amber-500/50 focus-visible:ring-amber-500/20"
              placeholder="Enter new name"
              autoFocus
            />
            <p className="text-xs text-textMuted/60">
              Use lowercase letters, numbers, and hyphens
            </p>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 bg-[#080809] border-t border-border/30 flex-row justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-textMuted hover:text-textMain transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !hasChanges}
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-amber-500 text-black shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            Save Changes
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

