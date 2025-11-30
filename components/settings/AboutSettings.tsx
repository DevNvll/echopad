import { Separator } from '@/components/ui/separator'
import { useUpdaterStore, UpdateStatus } from '@/stores'
import {
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react'
import { getVersion } from '@tauri-apps/api/app'
import { useEffect, useState } from 'react'

interface AboutSettingsProps {
  appName: string
}

function UpdateStatusDisplay({
  status,
  progress,
  error,
  version
}: {
  status: UpdateStatus
  progress: number
  error: string | null
  version: string | null
}) {
  switch (status) {
    case 'checking':
      return (
        <div className="flex items-center gap-2 text-xs text-textMuted">
          <Loader2 size={14} className="animate-spin" />
          <span>Checking for updates...</span>
        </div>
      )
    case 'available':
      return (
        <div className="flex items-center gap-2 text-xs text-brand">
          <Download size={14} />
          <span>Version {version} available</span>
        </div>
      )
    case 'not-available':
      return (
        <div className="flex items-center gap-2 text-xs text-green-500">
          <CheckCircle2 size={14} />
          <span>You're up to date</span>
        </div>
      )
    case 'downloading':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-textMuted">
            <Loader2 size={14} className="animate-spin" />
            <span>Downloading update... {progress}%</span>
          </div>
          <div className="h-1.5 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-brand rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )
    case 'ready':
      return (
        <div className="flex items-center gap-2 text-xs text-green-500">
          <CheckCircle2 size={14} />
          <span>Update ready! Restarting...</span>
        </div>
      )
    case 'error':
      return (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <XCircle size={14} />
          <span>{error || 'Update check failed'}</span>
        </div>
      )
    default:
      return null
  }
}

export function AboutSettings({ appName }: AboutSettingsProps) {
  const {
    status,
    progress,
    error,
    version: newVersion,
    checkForUpdates,
    downloadAndInstall
  } = useUpdaterStore()

  const [currentVersion, setCurrentVersion] = useState<string>('...')

  useEffect(() => {
    getVersion().then(setCurrentVersion)
  }, [])

  const isChecking = status === 'checking'
  const isDownloading = status === 'downloading'
  const isUpdateAvailable = status === 'available'
  const canCheck = !isChecking && !isDownloading && status !== 'ready'

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-textMain mb-1">About</h3>
        <p className="text-xs text-textMuted">Information about the app</p>
      </div>
      <Separator className="bg-border/50" />
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand/30 to-brand/10 border border-brand/20 flex items-center justify-center">
            <span className="text-2xl font-bold text-brand">
              {appName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h4 className="font-semibold text-textMain">{appName}</h4>
            <p className="text-xs text-textMuted">Version {currentVersion}</p>
          </div>
        </div>
        <p className="text-sm text-textMuted leading-relaxed">
          A modern note-taking app with a Discord-inspired interface. Organize
          your thoughts with notebooks, tags, and powerful search.
        </p>

        {/* Update Section */}
        <div className="pt-2 space-y-3">
          <Separator className="bg-border/30" />

          <div className="flex items-center justify-between">
            <span className="text-sm text-textMuted">Updates</span>
            <div className="flex items-center gap-2">
              {isUpdateAvailable && (
                <button
                  onClick={downloadAndInstall}
                  disabled={isDownloading}
                  className="px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-md hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Download size={12} />
                  Install Update
                </button>
              )}
              <button
                onClick={checkForUpdates}
                disabled={!canCheck}
                className="px-3 py-1.5 text-xs font-medium bg-surface hover:bg-surface/80 text-textMain rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <RefreshCw size={12} className={isChecking ? 'animate-spin' : ''} />
                Check for Updates
              </button>
            </div>
          </div>

          <UpdateStatusDisplay
            status={status}
            progress={progress}
            error={error}
            version={newVersion}
          />
        </div>

        <div className="pt-2 text-xs text-textMuted/70">
          Built with Tauri + React
        </div>
      </div>
    </div>
  )
}
