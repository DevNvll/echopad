import { useState, useEffect, useCallback } from 'react'
import { FolderPlus, Folder, ChevronRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useVaultStore, useNotebookStore, useUIStore } from '../../stores'

export function CreateNotebookModal() {
  const { vaultPath } = useVaultStore()
  const { createNotebook, selectNotebook } = useNotebookStore()
  const { isCreateModalOpen, parentNotebook, closeCreateModal } = useUIStore()

  const [name, setName] = useState('')

  const isSubnotebook = !!parentNotebook

  useEffect(() => {
    if (isCreateModalOpen) {
      setName('')
    }
  }, [isCreateModalOpen])

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !vaultPath) return
    const nb = await createNotebook(
      vaultPath,
      name.trim(),
      parentNotebook?.relativePath
    )
    setName('')
    closeCreateModal()
    selectNotebook(nb.relativePath)
  }, [
    name,
    vaultPath,
    createNotebook,
    parentNotebook,
    closeCreateModal,
    selectNotebook
  ])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && name.trim()) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit, name]
  )

  return (
    <Dialog
      open={isCreateModalOpen}
      onOpenChange={(open) => !open && closeCreateModal()}
    >
      <DialogContent
        className="w-full max-w-md p-0 gap-0 bg-[#0c0c0e] border-border/60 overflow-hidden"
        showCloseButton={false}
      >
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
              <FolderPlus className="w-6 h-6 text-brand" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold text-textMain">
                {isSubnotebook ? 'Create Subnotebook' : 'Create Notebook'}
              </DialogTitle>
              <DialogDescription className="text-sm text-textMuted mt-0.5">
                {isSubnotebook
                  ? 'Add a new notebook inside the selected folder'
                  : 'Create a new notebook to organize your notes'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {isSubnotebook && parentNotebook && (
            <div className="flex items-center gap-2 text-sm text-textMuted bg-surfaceHighlight/40 rounded-lg px-3 py-2.5 border border-border/30">
              <Folder size={14} className="text-textMuted/70 shrink-0" />
              <span className="truncate">{parentNotebook.relativePath}</span>
              <ChevronRight size={14} className="text-textMuted/50 shrink-0" />
              <span className="text-brand font-medium">New</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-textMuted/80 uppercase tracking-wider">
              {isSubnotebook ? 'Subnotebook Name' : 'Notebook Name'}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-black/40 border-border/50 text-textMain placeholder:text-textMuted/40 focus-visible:border-brand/50 focus-visible:ring-brand/20"
              placeholder="e.g. project-alpha"
              autoFocus
            />
            <p className="text-xs text-textMuted/60">
              Use lowercase letters, numbers, and hyphens
            </p>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 bg-[#080809] border-t border-border/30 flex-row justify-end gap-3">
          <button
            onClick={closeCreateModal}
            className="px-4 py-2 text-sm font-medium text-textMuted hover:text-textMain transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-brand text-white shadow-lg shadow-brand/20 hover:bg-brand/90 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            Create {isSubnotebook ? 'Subnotebook' : 'Notebook'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
