import {
  Trash2,
  AlertTriangle,
  Folder,
  FileText,
  FolderTree
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useCallback } from 'react'
import { useVaultStore, useNotebookStore, useUIStore } from '../../stores'

export function DeleteNotebookModal() {
  const { vaultPath } = useVaultStore()
  const { deleteNotebook } = useNotebookStore()
  const { isDeleteModalOpen, targetNotebook, closeDeleteModal } = useUIStore()

  const hasChildren =
    targetNotebook?.children && targetNotebook.children.length > 0

  const handleSubmit = useCallback(async () => {
    if (!vaultPath || !targetNotebook) return
    await deleteNotebook(vaultPath, targetNotebook.relativePath)
    closeDeleteModal()
  }, [vaultPath, targetNotebook, deleteNotebook, closeDeleteModal])

  return (
    <Dialog
      open={isDeleteModalOpen}
      onOpenChange={(open) => !open && closeDeleteModal()}
    >
      <DialogContent
        className="w-full max-w-md p-0 gap-0 bg-[#0c0c0e] border-border/60 overflow-hidden"
        showCloseButton={false}
      >
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold text-textMain">
                Delete Notebook
              </DialogTitle>
              <DialogDescription className="text-sm text-textMuted mt-0.5">
                This action is permanent and cannot be undone
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm">
                <p className="text-textMain">
                  You are about to delete{' '}
                  <span className="font-semibold text-red-400">
                    {targetNotebook?.name}
                  </span>
                </p>
                <p className="text-textMuted">This will permanently remove:</p>
                <ul className="space-y-1.5 text-textMuted">
                  <li className="flex items-center gap-2">
                    <FileText size={14} className="text-red-400/70" />
                    All notes in this notebook
                  </li>
                  {hasChildren && (
                    <li className="flex items-center gap-2">
                      <FolderTree size={14} className="text-red-400/70" />
                      All subnotebooks and their contents
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm bg-surfaceHighlight/40 rounded-lg px-3 py-2.5 border border-border/30">
            <Folder size={16} className="text-red-400/70 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-textMain truncate">
                {targetNotebook?.name}
              </p>
              <p className="text-xs text-textMuted truncate">
                {targetNotebook?.relativePath}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 bg-[#080809] border-t border-border/30 flex-row justify-end gap-3">
          <Button variant="ghost" onClick={closeDeleteModal}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleSubmit}>
            Delete Notebook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
