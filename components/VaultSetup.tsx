import { useState, useEffect } from 'react'
import { FolderOpen, Cloud, Download, Plus, Loader2, ChevronLeft, HardDrive } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { AppSettings } from '../types'
import { TitleBar } from './TitleBar'
import { ThemeProvider } from '../contexts/ThemeContext'
import { VaultCustomization } from './VaultCustomization'
import { Button } from '@/components/ui/button'
import { SyncLogin } from './sync/SyncLogin'
import { useSyncStore } from '../stores/syncStore'
import type { VaultInfo } from '../types/sync'

interface VaultSetupProps {
  appSettings: AppSettings
  onSelectVault: () => Promise<string | null>
  onConfirmVault: (path: string, icon: string, accentColor: string) => Promise<void>
  onOpenCommandPalette: () => void
}

type SetupStep = 'choose' | 'local' | 'sync-login' | 'sync-vaults' | 'customize'

export function VaultSetup({
  appSettings,
  onSelectVault,
  onConfirmVault,
  onOpenCommandPalette
}: VaultSetupProps) {
  const [step, setStep] = useState<SetupStep>('choose')
  const [selectedVaultPath, setSelectedVaultPath] = useState<string | null>(null)
  const [tempAccentColor, setTempAccentColor] = useState(appSettings.accentColor)
  const [remoteVaults, setRemoteVaults] = useState<VaultInfo[]>([])
  const [isLoadingVaults, setIsLoadingVaults] = useState(false)
  const [selectedRemoteVault, setSelectedRemoteVault] = useState<VaultInfo | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  const { 
    isLoggedIn, 
    user, 
    listRemoteVaults, 
    connectVault,
    initializeFromStorage 
  } = useSyncStore()

  // Try to restore auth on mount
  useEffect(() => {
    initializeFromStorage()
  }, [initializeFromStorage])

  // Load remote vaults when logged in and on sync-vaults step
  useEffect(() => {
    if (isLoggedIn && step === 'sync-vaults') {
      loadRemoteVaults()
    }
  }, [isLoggedIn, step])

  const loadRemoteVaults = async () => {
    setIsLoadingVaults(true)
    try {
      const vaults = await listRemoteVaults()
      setRemoteVaults(vaults)
    } catch (error) {
      console.error('Failed to load remote vaults:', error)
    } finally {
      setIsLoadingVaults(false)
    }
  }

  const handleSelectLocalVault = async () => {
    const path = await onSelectVault()
    if (path) {
      setSelectedVaultPath(path)
      setStep('customize')
    }
  }

  const handleSyncOption = () => {
    if (isLoggedIn) {
      setStep('sync-vaults')
    } else {
      setStep('sync-login')
    }
  }

  const handleLoginSuccess = () => {
    setStep('sync-vaults')
  }

  const handleConnectRemoteVault = async (vault: VaultInfo) => {
    setSelectedRemoteVault(vault)
    
    // Let user select a local folder to sync to
    const selected = await open({
      directory: true,
      multiple: false,
      title: `Select folder for "${vault.name}"`
    })

    if (selected && typeof selected === 'string') {
      setIsConnecting(true)
      try {
        await connectVault(selected, vault.id)
        setSelectedVaultPath(selected)
        // Skip customization for connected vaults, go straight to app
        await onConfirmVault(selected, 'Cloud', appSettings.accentColor)
      } catch (error) {
        console.error('Failed to connect vault:', error)
      } finally {
        setIsConnecting(false)
      }
    }
  }

  const handleCreateNewSyncedVault = async () => {
    const path = await onSelectVault()
    if (path) {
      setSelectedVaultPath(path)
      setStep('customize')
    }
  }

  const handleCustomizationComplete = async (icon: string, accentColor: string) => {
    if (selectedVaultPath) {
      setTempAccentColor(accentColor)
      await onConfirmVault(selectedVaultPath, icon, accentColor)
    }
  }

  const handleSkip = async () => {
    if (selectedVaultPath) {
      await onConfirmVault(selectedVaultPath, 'FolderOpen', appSettings.accentColor)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const vaultName = selectedVaultPath?.split(/[/\\]/).pop() || 'Vault'
  const currentSettings = { ...appSettings, accentColor: tempAccentColor }

  return (
    <ThemeProvider initialSettings={currentSettings} vaultPath={null}>
      <div className="h-screen w-screen bg-transparent font-sans text-textMain">
        <div className="flex flex-col h-full w-full overflow-hidden rounded-lg border border-border/50 bg-background">
          <TitleBar onOpenCommandPalette={onOpenCommandPalette} />
          <div className="flex-1 flex items-center justify-center p-4">
            
            {/* Step 1: Choose between local or sync */}
            {step === 'choose' && (
              <div className="max-w-lg w-full bg-surface border border-border rounded-2xl p-8 shadow-2xl">
                <div className="flex flex-col items-center text-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand/20 to-brand/5 border border-brand/20 flex items-center justify-center">
                    <FolderOpen className="w-8 h-8 text-brand" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold mb-2">
                      Welcome to {appSettings.appName}
                    </h1>
                    <p className="text-textMuted text-sm">
                      Get started by creating a new vault or connecting to an existing one.
                    </p>
                  </div>

                  <div className="w-full space-y-3">
                    <Button
                      variant="outline"
                      onClick={handleSelectLocalVault}
                      className="w-full p-4 h-auto rounded-xl border-border hover:border-brand/50 hover:bg-brand/5 text-left group"
                    >
                      <div className="flex items-center gap-4 w-full">
                        <div className="p-3 rounded-lg bg-surfaceHighlight group-hover:bg-brand/10 transition-colors">
                          <HardDrive className="w-5 h-5 text-textMuted group-hover:text-brand transition-colors" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-textMain">Create Local Vault</p>
                          <p className="text-xs text-textMuted font-normal">Store notes on this device only</p>
                        </div>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleSyncOption}
                      className="w-full p-4 h-auto rounded-xl border-border hover:border-brand/50 hover:bg-brand/5 text-left group"
                    >
                      <div className="flex items-center gap-4 w-full">
                        <div className="p-3 rounded-lg bg-surfaceHighlight group-hover:bg-brand/10 transition-colors">
                          <Cloud className="w-5 h-5 text-textMuted group-hover:text-brand transition-colors" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-textMain">
                            {isLoggedIn ? 'Connect Synced Vault' : 'Sign in to Sync'}
                          </p>
                          <p className="text-xs text-textMuted font-normal">
                            {isLoggedIn 
                              ? `Signed in as ${user?.email}` 
                              : 'Sync notes across devices'}
                          </p>
                        </div>
                      </div>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Sync Login */}
            {step === 'sync-login' && (
              <SyncLogin 
                onClose={() => setStep('choose')} 
                onSuccess={handleLoginSuccess}
              />
            )}

            {/* Remote Vaults List */}
            {step === 'sync-vaults' && (
              <div className="max-w-lg w-full bg-surface border border-border rounded-2xl p-8 shadow-2xl">
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="ghost"
                      size="icon"
                      onClick={() => setStep('choose')}
                      className="h-9 w-9 text-textMuted"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div>
                      <h2 className="text-lg font-bold">Your Vaults</h2>
                      <p className="text-xs text-textMuted">
                        Connect to an existing vault or create a new one
                      </p>
                    </div>
                  </div>

                  {isLoadingVaults ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-brand" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {remoteVaults.map((vault) => (
                        <Button
                          key={vault.id}
                          variant="outline"
                          onClick={() => handleConnectRemoteVault(vault)}
                          disabled={isConnecting}
                          className="w-full p-4 h-auto rounded-xl border-border hover:border-brand/50 hover:bg-brand/5 text-left group"
                        >
                          <div className="flex items-center gap-4 w-full">
                            <div className="p-3 rounded-lg bg-surfaceHighlight group-hover:bg-brand/10 transition-colors">
                              <Download className="w-5 h-5 text-textMuted group-hover:text-brand transition-colors" />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <p className="font-medium text-textMain truncate">{vault.name}</p>
                              <p className="text-xs text-textMuted font-normal">
                                {vault.file_count} files • {formatBytes(vault.total_size_bytes)}
                              </p>
                            </div>
                            {isConnecting && selectedRemoteVault?.id === vault.id && (
                              <Loader2 className="w-5 h-5 animate-spin text-brand" />
                            )}
                          </div>
                        </Button>
                      ))}

                      {remoteVaults.length === 0 && (
                        <div className="text-center py-6 text-textMuted text-sm">
                          No synced vaults found. Create one to get started.
                        </div>
                      )}

                      <div className="pt-2 border-t border-border">
                        <Button
                          variant="outline"
                          onClick={handleCreateNewSyncedVault}
                          className="w-full p-4 h-auto rounded-xl border-dashed border-border hover:border-brand/50 hover:bg-brand/5 text-left group"
                        >
                          <div className="flex items-center gap-4 w-full">
                            <div className="p-3 rounded-lg bg-surfaceHighlight group-hover:bg-brand/10 transition-colors">
                              <Plus className="w-5 h-5 text-textMuted group-hover:text-brand transition-colors" />
                            </div>
                            <div className="text-left">
                              <p className="font-medium text-textMain">Create New Vault</p>
                              <p className="text-xs text-textMuted font-normal">Start fresh with a new synced vault</p>
                            </div>
                          </div>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Customization */}
            {step === 'customize' && (
              <VaultCustomization
                vaultName={vaultName}
                onComplete={handleCustomizationComplete}
                onSkip={handleSkip}
              />
            )}
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}
