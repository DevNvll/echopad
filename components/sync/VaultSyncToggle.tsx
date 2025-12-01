import { useState } from 'react'
import { Loader2, RefreshCw, AlertCircle, CheckCircle, CloudOff, Copy } from 'lucide-react'
import { useSyncStore } from '../../stores/syncStore'
import { useDevMode } from '../../hooks'
import { Button } from '@/components/ui/button'
import type { VaultSyncStatus } from '../../types/sync'

interface VaultSyncToggleProps {
  vaultPath: string
  vaultName: string
  status?: VaultSyncStatus
}

export function VaultSyncToggle({ vaultPath, vaultName, status }: VaultSyncToggleProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [copied, setCopied] = useState(false)
  const { enableVaultSync, disableVaultSync, syncNow, isLoggedIn } = useSyncStore()
  const { isDevMode } = useDevMode()

  const isEnabled = status?.enabled ?? false
  const syncStatus = status?.status ?? 'disabled'
  const lastSyncAt = status?.last_sync_at
  const pendingChanges = status?.pending_changes ?? 0
  const vaultId = status?.vault_id

  const copyVaultId = async () => {
    if (vaultId) {
      await navigator.clipboard.writeText(vaultId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleToggle = async () => {
    if (!isLoggedIn) return

    try {
      if (isEnabled) {
        await disableVaultSync(vaultPath)
      } else {
        await enableVaultSync(vaultPath, vaultName)
      }
    } catch (error) {
      console.error('Failed to toggle sync:', error)
    }
  }

  const handleSyncNow = async () => {
    if (!isEnabled) return

    setIsSyncing(true)
    try {
      await syncNow(vaultPath)
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  const formatLastSync = (timestamp: number | null | undefined) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffMs / 60000)

    if (diffSecs < 10) return 'Just now'
    if (diffSecs < 60) return `${diffSecs}s ago`
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return date.toLocaleDateString()
  }

  const getStatusIcon = () => {
    if (syncStatus === 'syncing' || isSyncing) {
      return <Loader2 className="w-5 h-5 animate-spin text-brand" />
    }
    if (syncStatus === 'error') {
      return <AlertCircle className="w-5 h-5 text-red-400" />
    }
    if (isEnabled) {
      return <CheckCircle className="w-5 h-5 text-green-400" />
    }
    return <CloudOff className="w-5 h-5 text-textMuted" />
  }

  const getStatusText = () => {
    if (syncStatus === 'syncing' || isSyncing) return 'Syncing...'
    if (syncStatus === 'error') return 'Sync error'
    if (pendingChanges > 0) return `${pendingChanges} pending`
    if (isEnabled) return 'Synced'
    return 'Not syncing'
  }

  return (
    <div className="p-4 rounded-lg bg-surfaceHighlight border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-surface">
            {getStatusIcon()}
          </div>
          <div>
            <p className="font-medium text-textMain">{vaultName}</p>
            <p className="text-xs text-textMuted">
              {getStatusText()} • Last sync: {formatLastSync(lastSyncAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEnabled && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSyncNow}
              disabled={isSyncing || syncStatus === 'syncing'}
              className="h-9 w-9 text-textMuted hover:text-textMain"
              title="Sync now"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </Button>
          )}

          {/* Toggle switch */}
          <button
            onClick={handleToggle}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              isEnabled ? 'bg-brand' : 'bg-surface'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                isEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Dev mode: Show vault ID */}
      {isDevMode && vaultId && (
        <Button
          variant="ghost"
          onClick={copyVaultId}
          className="mt-3 flex items-center gap-2 w-full p-2 h-auto rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 group"
        >
          <span className="text-[10px] text-amber-400/70 uppercase tracking-wider font-medium shrink-0">
            Vault ID
          </span>
          <span className="flex-1 text-xs text-amber-400 font-mono text-left break-all">
            {vaultId}
          </span>
          <Copy
            size={12}
            className={`shrink-0 transition-colors ${
              copied ? 'text-green-400' : 'text-amber-400/50 group-hover:text-amber-400'
            }`}
          />
        </Button>
      )}

      {syncStatus === 'error' && (
        <div className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-400">
            There was an error syncing this vault. Try syncing again.
          </p>
        </div>
      )}
    </div>
  )
}
