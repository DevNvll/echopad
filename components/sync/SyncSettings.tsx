import { useState, useEffect } from 'react'
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Monitor,
  LogOut,
  AlertCircle,
  ChevronRight,
} from 'lucide-react'
import { useSyncStore } from '../../stores/syncStore'
import { useVaultStore } from '../../stores/vaultStore'
import { SyncLogin } from './SyncLogin'
import { DeviceManager } from './DeviceManager'
import { VaultSyncToggle } from './VaultSyncToggle'

export function SyncSettings() {
  const [showDevices, setShowDevices] = useState(false)
  const {
    isLoggedIn,
    user,
    vaultStatuses,
    isLoading,
    error,
    showLoginModal,
    setShowLoginModal,
    logout,
    refreshStatus,
    clearError,
    initializeFromStorage,
  } = useSyncStore()

  const { vaultPath } = useVaultStore()

  // Try to restore auth state on mount
  useEffect(() => {
    initializeFromStorage()
  }, [initializeFromStorage])

  useEffect(() => {
    if (isLoggedIn) {
      refreshStatus()
    }
  }, [isLoggedIn, refreshStatus])

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const usagePercent = user
    ? Math.round((user.storage_used_bytes / user.storage_quota_bytes) * 100)
    : 0

  if (!isLoggedIn) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surfaceHighlight flex items-center justify-center">
            <CloudOff className="w-8 h-8 text-textMuted" />
          </div>
          <h3 className="text-lg font-medium text-textMain mb-2">
            Sync is not enabled
          </h3>
          <p className="text-sm text-textMuted mb-6 max-w-sm mx-auto">
            Sign in to sync your notes across devices.
          </p>
          <button
            onClick={() => setShowLoginModal(true)}
            className="px-6 py-2.5 rounded-lg bg-brand text-white font-medium hover:opacity-90 transition-opacity"
          >
            Sign in to Sync
          </button>
        </div>

        {showLoginModal && <SyncLogin onClose={() => setShowLoginModal(false)} />}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Account info - simplified */}
      <div className="p-4 rounded-lg bg-surfaceHighlight border border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white font-medium">
              {user?.email.charAt(0).toUpperCase()}
            </div>
            <p className="font-medium text-textMain">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg text-textMuted hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Storage usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-textMuted">Storage</span>
            <span className="text-textMain">
              {formatBytes(user?.storage_used_bytes || 0)} / {formatBytes(user?.storage_quota_bytes || 0)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface overflow-hidden">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${Math.max(usagePercent, 1)}%` }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={clearError}
              className="text-xs text-red-400/70 hover:text-red-400 mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Vault sync status */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-textMuted">Vault Sync</h4>
          <button
            onClick={() => refreshStatus()}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-textMuted hover:text-textMain hover:bg-surfaceHighlight transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {vaultPath && (
          <VaultSyncToggle
            vaultPath={vaultPath}
            vaultName={vaultPath.split(/[/\\]/).pop() || 'Vault'}
            status={vaultStatuses.find((v) => v.vault_path === vaultPath)}
          />
        )}

        {vaultStatuses.length === 0 && !vaultPath && (
          <p className="text-sm text-textMuted text-center py-4">
            No vaults are being synced
          </p>
        )}
      </div>

      {/* Devices */}
      <div>
        <button
          onClick={() => setShowDevices(!showDevices)}
          className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-surfaceHighlight transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-surfaceHighlight">
              <Monitor className="w-5 h-5 text-textMuted" />
            </div>
            <span className="text-sm text-textMain">Connected Devices</span>
          </div>
          <ChevronRight
            className={`w-5 h-5 text-textMuted transition-transform ${
              showDevices ? 'rotate-90' : ''
            }`}
          />
        </button>

        {showDevices && <DeviceManager />}
      </div>

      {showLoginModal && <SyncLogin onClose={() => setShowLoginModal(false)} />}
    </div>
  )
}
