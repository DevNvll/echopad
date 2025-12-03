import { useState, useEffect, useCallback } from 'react'
import { Kanban } from 'lucide-react'
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
import { useVaultStore, useUIStore } from '../../stores'
import { useBoardStore } from '../../stores/boardStore'
import { useRouterStore } from '../../stores/routerStore'

export function CreateBoardModal() {
  const { vaultPath } = useVaultStore()
  const { createBoard, selectBoard } = useBoardStore()
  const { navigateToBoard } = useRouterStore()
  const { isCreateBoardModalOpen, closeCreateBoardModal } = useUIStore()

  const [name, setName] = useState('')

  useEffect(() => {
    if (isCreateBoardModalOpen) {
      setName('')
    }
  }, [isCreateBoardModalOpen])

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !vaultPath) return
    const board = await createBoard(vaultPath, name.trim())
    setName('')
    closeCreateBoardModal()
    selectBoard(board.filename)
    navigateToBoard(board.filename)
  }, [name, vaultPath, createBoard, closeCreateBoardModal, selectBoard, navigateToBoard])

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
      open={isCreateBoardModalOpen}
      onOpenChange={(open) => !open && closeCreateBoardModal()}
    >
      <DialogContent
        className="w-full max-w-md p-0 gap-0 bg-[#0c0c0e] border-border/60 overflow-hidden"
        showCloseButton={false}
      >
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
              <Kanban className="w-6 h-6 text-brand" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold text-textMain">
                Create Board
              </DialogTitle>
              <DialogDescription className="text-sm text-textMuted mt-0.5">
                Create a new kanban board to organize your tasks
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-textMuted/80 uppercase tracking-wider">
              Board Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-black/40 border-border/50 text-textMain placeholder:text-textMuted/40 focus-visible:border-brand/50 focus-visible:ring-brand/20"
              placeholder="e.g. Project Tasks"
              autoFocus
            />
            <p className="text-xs text-textMuted/60">
              Give your board a descriptive name
            </p>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 bg-[#080809] border-t border-border/30 flex-row justify-end gap-3">
          <Button variant="ghost" onClick={closeCreateBoardModal}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            Create Board
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
