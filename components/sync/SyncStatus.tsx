import { Cloud, CloudOff, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { useSyncStore } from '../../stores/syncStore'

interface SyncStatusProps {
  compact?: boolean
  onClick?: () => void
}

export function SyncStatus({ compact = false, onClick }: SyncStatusProps) {
  const { isLoggedIn, vaultStatuses, isLoading } = useSyncStore()

  // Determine overall status
  const isSyncing = vaultStatuses.some((v) => v.status === 'syncing') || isLoading
  const hasError = vaultStatuses.some((v) => v.status === 'error')
  const hasEnabledVaults = vaultStatuses.some((v) => v.enabled)
  const pendingChanges = vaultStatuses.reduce((sum, v) => sum + v.pending_changes, 0)

  if (!isLoggedIn) {
    if (compact) {
      return (
        <button
          onClick={onClick}
          className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
          title="Sync is not enabled"
        >
          <CloudOff className="w-4 h-4" />
        </button>
      )
    }

    return (
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
      >
        <CloudOff className="w-4 h-4" />
        <span className="text-sm">Sync off</span>
      </button>
    )
  }

  if (isSyncing) {
    if (compact) {
      return (
        <button
          onClick={onClick}
          className="p-1.5 rounded-lg text-[var(--accent-color)] hover:bg-[var(--bg-secondary)] transition-colors"
          title="Syncing..."
        >
          <Loader2 className="w-4 h-4 animate-spin" />
        </button>
      )
    }

    return (
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[var(--accent-color)] hover:bg-[var(--bg-secondary)] transition-colors"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Syncing...</span>
      </button>
    )
  }

  if (hasError) {
    if (compact) {
      return (
        <button
          onClick={onClick}
          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
          title="Sync error"
        >
          <AlertCircle className="w-4 h-4" />
        </button>
      )
    }

    return (
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
      >
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">Sync error</span>
      </button>
    )
  }

  if (pendingChanges > 0) {
    if (compact) {
      return (
        <button
          onClick={onClick}
          className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-colors relative"
          title={`${pendingChanges} pending changes`}
        >
          <Cloud className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full text-[8px] text-black font-bold flex items-center justify-center">
            {pendingChanges > 9 ? '!' : pendingChanges}
          </span>
        </button>
      )
    }

    return (
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-colors"
      >
        <Cloud className="w-4 h-4" />
        <span className="text-sm">{pendingChanges} pending</span>
      </button>
    )
  }

  // All synced
  if (compact) {
    return (
      <button
        onClick={onClick}
        className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/10 transition-colors"
        title="All synced"
      >
        <CheckCircle className="w-4 h-4" />
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-green-400 hover:bg-green-500/10 transition-colors"
    >
      <CheckCircle className="w-4 h-4" />
      <span className="text-sm">Synced</span>
    </button>
  )
}


