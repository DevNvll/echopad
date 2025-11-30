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
import { Button } from '@/components/ui/button'
import { useVaultStore, useNotebookStore, useUIStore } from '../../stores'

export function EditNotebookModal() {
  const { vaultPath } = useVaultStore()
  const { updateNotebook } = useNotebookStore()
  const { isEditModalOpen, targetNotebook, closeEditModal } = useUIStore()

  const [name, setName] = useState('')

  useEffect(() => {
    if (isEditModalOpen && targetNotebook) {
      setName(targetNotebook.name)
    }
  }, [isEditModalOpen, targetNotebook])

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !vaultPath || !targetNotebook) return
    await updateNotebook(vaultPath, targetNotebook.relativePath, name.trim())
    closeEditModal()
  }, [name, vaultPath, targetNotebook, updateNotebook, closeEditModal])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && name.trim()) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit, name]
  )

  const hasChanges = name.trim() !== targetNotebook?.name

  return (
    <Dialog
      open={isEditModalOpen}
      onOpenChange={(open) => !open && closeEditModal()}
    >
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
              {targetNotebook?.name}
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
          <Button variant="ghost" onClick={closeEditModal}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !hasChanges}
            className="bg-amber-500 text-black hover:bg-amber-400"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
