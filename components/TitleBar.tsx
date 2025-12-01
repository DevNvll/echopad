import { useState, useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Minus, Square, X, Copy, Search, RefreshCw, Cloud, CloudOff, AlertCircle, CheckCircle, CloudDownload } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useSyncStore } from '@/stores/syncStore'
import { useVaultStore } from '@/stores/vaultStore'

interface TitleBarProps {
  onOpenCommandPalette?: () => void
}

// Refresh sync status every 10 seconds when sync is enabled
const SYNC_STATUS_REFRESH_INTERVAL = 10000

export function TitleBar({ onOpenCommandPalette }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [isSyncingManual, setIsSyncingManual] = useState(false)
  const { settings } = useTheme()
  const appWindow = getCurrentWindow()
  
  const { isLoggedIn, vaultStatuses, syncNow, refreshStatus, remotePendingChanges } = useSyncStore()
  const { vaultPath } = useVaultStore()

  // Sync status for current vault
  const currentVaultStatus = vaultStatuses.find((v) => v.vault_path === vaultPath)
  const isSyncEnabled = isLoggedIn && currentVaultStatus?.enabled

  // Periodic sync status refresh
  useEffect(() => {
    if (!isSyncEnabled) return
    
    // Set up interval for periodic refresh
    const intervalId = window.setInterval(() => {
      refreshStatus()
    }, SYNC_STATUS_REFRESH_INTERVAL)
    
    return () => {
      clearInterval(intervalId)
    }
  }, [isSyncEnabled, refreshStatus])

  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await appWindow.isMaximized()
      setIsMaximized(maximized)
    }
    checkMaximized()

    const unlisten = appWindow.onResized(async () => {
      const maximized = await appWindow.isMaximized()
      setIsMaximized(maximized)
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [appWindow])

  const handleMinimize = () => appWindow.minimize()
  const handleMaximize = () => appWindow.toggleMaximize()
  const handleClose = () => appWindow.close()

  const isSyncing = currentVaultStatus?.status === 'syncing' || isSyncingManual
  const hasError = currentVaultStatus?.status === 'error'
  const pendingChanges = currentVaultStatus?.pending_changes ?? 0
  const remotePending = remotePendingChanges[vaultPath ?? ''] ?? 0

  const handleSyncNow = async () => {
    if (!vaultPath || !isSyncEnabled || isSyncing) return
    
    setIsSyncingManual(true)
    try {
      await syncNow(vaultPath)
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setIsSyncingManual(false)
    }
  }

  const getSyncIcon = () => {
    if (!isLoggedIn) return <CloudOff size={14} className="text-textMuted/50" />
    if (!isSyncEnabled) return <CloudOff size={14} className="text-textMuted/50" />
    if (isSyncing) return <RefreshCw size={14} className="animate-spin text-accent" />
    if (hasError) return <AlertCircle size={14} className="text-red-400" />
    if (remotePending > 0) return <CloudDownload size={14} className="text-blue-400" />
    if (pendingChanges > 0) return <Cloud size={14} className="text-amber-400" />
    return <CheckCircle size={14} className="text-green-400" />
  }

  const getSyncTooltip = () => {
    if (!isLoggedIn) return 'Sync not enabled'
    if (!isSyncEnabled) return 'Sync not enabled for this vault'
    if (isSyncing) return 'Syncing...'
    if (hasError) return 'Sync error - click to retry'
    
    const parts: string[] = []
    if (pendingChanges > 0) parts.push(`${pendingChanges} local`)
    if (remotePending > 0) parts.push(`${remotePending} remote`)
    
    if (parts.length > 0) return `${parts.join(', ')} changes - click to sync`
    return 'All synced - click to sync now'
  }

  return (
    <div className="h-9 flex items-center justify-between bg-sidebar border-b border-border/40 select-none rounded-t-lg">
      <div
        data-tauri-drag-region
        className="w-36 h-full flex items-center px-4 cursor-default shrink-0"
      >
        <span className="text-xs font-medium text-textMuted tracking-wide">
          {settings.appName.toLowerCase()}
        </span>
      </div>

      <div
        data-tauri-drag-region
        className="flex-1 h-full flex items-center justify-center px-4"
      >
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 h-6 w-full max-w-md bg-black/40 border border-border/50 rounded-md px-3 text-textMuted/50 hover:text-textMuted hover:border-border/80 hover:bg-black/60 transition-all cursor-pointer"
        >
          <Search size={12} />
          <span className="text-xs flex-1 text-left">Search...</span>
          <kbd className="hidden sm:inline-flex h-4 items-center gap-0.5 rounded border border-border/50 bg-surface/50 px-1 font-mono text-[9px] font-medium text-textMuted/50">
            Ctrl K
          </kbd>
        </button>
      </div>

      <div className="flex items-center h-full shrink-0">
        {/* Sync Now Button */}
        <button
          onClick={handleSyncNow}
          disabled={!isSyncEnabled || isSyncing}
          title={getSyncTooltip()}
          className={`h-full w-10 flex items-center justify-center transition-colors ${
            isSyncEnabled && !isSyncing
              ? 'hover:bg-white/5 cursor-pointer'
              : 'cursor-default opacity-60'
          }`}
        >
          {getSyncIcon()}
          {pendingChanges > 0 && isSyncEnabled && !isSyncing && (
            <span className="absolute top-1.5 ml-4 w-2 h-2 bg-amber-400 rounded-full" />
          )}
          {remotePending > 0 && pendingChanges === 0 && isSyncEnabled && !isSyncing && (
            <span className="absolute top-1.5 ml-4 w-2 h-2 bg-blue-400 rounded-full" />
          )}
        </button>

        <div className="w-px h-4 bg-border/30 mx-1" />

        <button
          onClick={handleMinimize}
          className="h-full w-12 flex items-center justify-center text-textMuted hover:bg-white/5 transition-colors"
        >
          <Minus size={14} strokeWidth={1.5} />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full w-12 flex items-center justify-center text-textMuted hover:bg-white/5 transition-colors"
        >
          {isMaximized ? (
            <Copy size={12} strokeWidth={1.5} className="rotate-180" />
          ) : (
            <Square size={11} strokeWidth={1.5} />
          )}
        </button>
        <button
          onClick={handleClose}
          className="h-full w-12 flex items-center justify-center text-textMuted hover:bg-red-500 hover:text-white transition-colors"
        >
          <X size={15} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
