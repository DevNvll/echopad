import { useState } from 'react'
import { Plus, Trash2, Check, Cloud, Download, Loader2 } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { KnownVault, addKnownVault } from '@/api'
import { getIconByName } from '@/components/IconPicker'
import { useSyncStore } from '@/stores/syncStore'
import type { VaultInfo } from '@/types/sync'

interface StorageSettingsProps {
  vaultPath: string | null
  knownVaults: KnownVault[]
  vaultIcons: Record<string, string>
  onAddVault: () => void
  onSwitchVault: (path: string) => void
  onRemoveVault: (path: string) => void
}

export function StorageSettings({
  vaultPath,
  knownVaults,
  vaultIcons,
  onAddVault,
  onSwitchVault,
  onRemoveVault
}: StorageSettingsProps) {
  const [showRemoteVaults, setShowRemoteVaults] = useState(false)
  const [remoteVaults, setRemoteVaults] = useState<VaultInfo[]>([])
  const [isLoadingRemote, setIsLoadingRemote] = useState(false)
  const [connectingVaultId, setConnectingVaultId] = useState<string | null>(
    null
  )

  const { isLoggedIn, listRemoteVaults, connectVault, refreshStatus } =
    useSyncStore()

  const loadRemoteVaults = async () => {
    setIsLoadingRemote(true)
    try {
      const vaults = await listRemoteVaults()
      setRemoteVaults(vaults)
    } catch (error) {
      console.error('Failed to load remote vaults:', error)
    } finally {
      setIsLoadingRemote(false)
    }
  }

  const handleShowRemoteVaults = () => {
    setShowRemoteVaults(true)
    loadRemoteVaults()
  }

  const handleConnectVault = async (vault: VaultInfo) => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: `Select folder for "${vault.name}"`
    })

    if (selected && typeof selected === 'string') {
      setConnectingVaultId(vault.id)
      try {
        await connectVault(selected, vault.id)
        await refreshStatus()
        // Add to known vaults before switching
        await addKnownVault(selected)
        setShowRemoteVaults(false)
        // Switch to the new vault
        onSwitchVault(selected)
      } catch (error) {
        console.error('Failed to connect vault:', error)
      } finally {
        setConnectingVaultId(null)
      }
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-textMain mb-1">Storage</h3>
        <p className="text-xs text-textMuted">
          Manage where your notes are stored
        </p>
      </div>
      <Separator className="bg-border/50" />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-textMain">Your Vaults</Label>
          <div className="flex items-center gap-2">
            {isLoggedIn && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleShowRemoteVaults}
                disabled={showRemoteVaults}
              >
                <Cloud size={14} />
                Connect Remote
              </Button>
            )}
            <Button size="sm" onClick={onAddVault}>
              <Plus size={14} />
              Add Local
            </Button>
          </div>
        </div>

        {/* Remote Vaults Panel */}
        {showRemoteVaults && (
          <div className="p-4 rounded-lg border border-brand/30 bg-brand/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud size={16} className="text-brand" />
                <span className="text-sm font-medium text-textMain">
                  Remote Vaults
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRemoteVaults(false)}
                className="text-xs"
              >
                Cancel
              </Button>
            </div>

            {isLoadingRemote ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-brand" />
              </div>
            ) : remoteVaults.length === 0 ? (
              <p className="text-sm text-textMuted text-center py-4">
                No remote vaults found. Create one from the Sync settings.
              </p>
            ) : (
              <div className="space-y-2">
                {remoteVaults.map((vault) => (
                  <button
                    key={vault.id}
                    onClick={() => handleConnectVault(vault)}
                    disabled={connectingVaultId !== null}
                    className="w-full p-3 rounded-lg border border-border hover:border-brand/50 hover:bg-brand/5 transition-colors text-left group disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-surfaceHighlight group-hover:bg-brand/10 transition-colors">
                        <Download
                          size={16}
                          className="text-textMuted group-hover:text-brand transition-colors"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-textMain truncate">
                          {vault.name}
                        </p>
                        <p className="text-xs text-textMuted">
                          {vault.file_count} files •{' '}
                          {formatBytes(vault.total_size_bytes)}
                        </p>
                      </div>
                      {connectingVaultId === vault.id && (
                        <Loader2 className="w-4 h-4 animate-spin text-brand" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-textMuted">
              Select a remote vault to sync to a local folder on this device.
            </p>
          </div>
        )}

        {/* Local Vaults List */}
        <div className="space-y-2">
          {knownVaults.length === 0 ? (
            <div className="p-4 text-center text-sm text-textMuted border border-dashed border-border rounded-lg">
              No vaults found. Add a vault to get started.
            </div>
          ) : (
            knownVaults.map((vault) => (
              <VaultItem
                key={vault.path}
                vault={vault}
                icon={vaultIcons[vault.path] || 'FolderOpen'}
                isActive={vault.path === vaultPath}
                onSwitch={() => onSwitchVault(vault.path)}
                onRemove={() => onRemoveVault(vault.path)}
              />
            ))
          )}
        </div>

        <p className="text-xs text-textMuted">
          Removing a vault from this list does not delete any files. It only
          removes it from your quick access list.
        </p>
      </div>
    </div>
  )
}

interface VaultItemProps {
  vault: KnownVault
  icon: string
  isActive: boolean
  onSwitch: () => void
  onRemove: () => void
}

function VaultItem({
  vault,
  icon,
  isActive,
  onSwitch,
  onRemove
}: VaultItemProps) {
  const IconComponent = getIconByName(icon)

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-colors group',
        isActive
          ? 'bg-brand/10 border-brand/30'
          : 'bg-surface border-border hover:border-border/80'
      )}
    >
      <div
        className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
          isActive
            ? 'bg-linear-to-br from-brand/30 to-brand/10 border border-brand/30'
            : 'bg-surfaceHighlight border border-border'
        )}
      >
        <IconComponent
          size={18}
          className={isActive ? 'text-brand' : 'text-textMuted'}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-textMain truncate">
            {vault.name}
          </span>
          {isActive && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-brand bg-brand/20 px-1.5 py-0.5 rounded">
              <Check size={10} />
              Active
            </span>
          )}
        </div>
        <div className="text-xs text-textMuted truncate">{vault.path}</div>
      </div>
      {!isActive && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="secondary" size="sm" onClick={onSwitch}>
            Switch
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 text-textMuted hover:text-red-400 hover:bg-red-400/10"
            title="Remove from list"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      )}
    </div>
  )
}
