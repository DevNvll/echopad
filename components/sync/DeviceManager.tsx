import { useState, useEffect } from 'react'
import { Monitor, Smartphone, Trash2, Loader2, CheckCircle } from 'lucide-react'
import { useSyncStore } from '../../stores/syncStore'
import type { DeviceInfo } from '../../types/sync'

export function DeviceManager() {
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const { getDevices, revokeDevice } = useSyncStore()

  useEffect(() => {
    loadDevices()
  }, [])

  const loadDevices = async () => {
    setIsLoading(true)
    try {
      const deviceList = await getDevices()
      setDevices(deviceList)
    } catch (error) {
      console.error('Failed to load devices:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRevoke = async (deviceId: string) => {
    if (!confirm('Are you sure you want to revoke this device? It will be signed out.')) {
      return
    }

    setRevokingId(deviceId)
    try {
      await revokeDevice(deviceId)
      setDevices((prev) => prev.filter((d) => d.id !== deviceId))
    } catch (error) {
      console.error('Failed to revoke device:', error)
    } finally {
      setRevokingId(null)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return formatDate(timestamp)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-2">
      {devices.map((device) => (
        <div
          key={device.id}
          className={`p-3 rounded-lg border transition-colors ${
            device.is_current
              ? 'bg-[var(--accent-color)]/5 border-[var(--accent-color)]/20'
              : 'bg-[var(--bg-secondary)] border-[var(--border-primary)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  device.is_current
                    ? 'bg-[var(--accent-color)]/10'
                    : 'bg-[var(--bg-tertiary)]'
                }`}
              >
                {device.device_type === 'desktop' ? (
                  <Monitor
                    className={`w-5 h-5 ${
                      device.is_current
                        ? 'text-[var(--accent-color)]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  />
                ) : (
                  <Smartphone
                    className={`w-5 h-5 ${
                      device.is_current
                        ? 'text-[var(--accent-color)]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-[var(--text-primary)]">{device.name}</p>
                  {device.is_current && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--accent-color)]/10 text-[var(--accent-color)]">
                      <CheckCircle className="w-3 h-3" />
                      This device
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Added {formatDate(device.created_at)} • Last sync:{' '}
                  {formatLastSync(device.last_sync_at)}
                </p>
              </div>
            </div>

            {!device.is_current && (
              <button
                onClick={() => handleRevoke(device.id)}
                disabled={revokingId === device.id}
                className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                title="Revoke device"
              >
                {revokingId === device.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      ))}

      {devices.length === 0 && (
        <p className="text-sm text-[var(--text-tertiary)] text-center py-4">
          No devices found
        </p>
      )}
    </div>
  )
}



