import { Cloud, ArrowUp, ArrowDown, Loader2 } from 'lucide-react'
import { useSyncStore } from '../../stores/syncStore'

interface SyncProgressProps {
  vaultPath: string
}

export function SyncProgress({ vaultPath }: SyncProgressProps) {
  const { vaultStatuses } = useSyncStore()
  const status = vaultStatuses.find((v) => v.vault_path === vaultPath)

  if (!status || status.status !== 'syncing') {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] shadow-lg">
        <div className="relative">
          <Cloud className="w-6 h-6 text-[var(--accent-color)]" />
          <div className="absolute -bottom-0.5 -right-0.5">
            <Loader2 className="w-3 h-3 text-[var(--accent-color)] animate-spin" />
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">Syncing...</p>
          <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
            <span className="flex items-center gap-1">
              <ArrowUp className="w-3 h-3" />
              Uploading
            </span>
            <span className="flex items-center gap-1">
              <ArrowDown className="w-3 h-3" />
              Downloading
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}



