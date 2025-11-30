import { useState, useCallback, useEffect } from 'react'
import { Settings, Palette, Info, X, HardDrive, Wrench } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import { removeKnownVault } from '@/api'
import {
  GeneralSettings,
  StorageSettings,
  AppearanceSettings,
  AboutSettings,
  AdvancedSettings
} from './settings'
import { useVaultStore, useUIStore } from '../stores'
import {
  useKnownVaults,
  useVaultIcons,
  useVaultIcon,
  useSaveVaultIcon,
  vaultKeys
} from '../hooks'

export type SettingsSection =
  | 'general'
  | 'storage'
  | 'appearance'
  | 'advanced'
  | 'about'

const NAV_ITEMS: {
  id: SettingsSection
  label: string
  icon: React.ReactNode
}[] = [
  { id: 'general', label: 'General', icon: <Settings size={16} /> },
  { id: 'storage', label: 'Storage', icon: <HardDrive size={16} /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
  { id: 'advanced', label: 'Advanced', icon: <Wrench size={16} /> },
  { id: 'about', label: 'About', icon: <Info size={16} /> }
]

export function SettingsModal() {
  const { vaultPath, selectVault, switchVault } = useVaultStore()
  const { isSettingsOpen, settingsSection, closeSettings } = useUIStore()
  const queryClient = useQueryClient()

  const {
    settings,
    updateAccentColor,
    updateAccentColorForAllVaults,
    updateAppName
  } = useTheme()
  const [activeSection, setActiveSection] = useState<SettingsSection>(
    settingsSection || 'general'
  )
  const [localAppName, setLocalAppName] = useState(settings.appName)
  const [showColorPicker, setShowColorPicker] = useState(false)

  const { data: knownVaults = [] } = useKnownVaults()
  const { data: vaultIcons = {} } = useVaultIcons(knownVaults)
  const { data: currentVaultIcon = 'FolderOpen' } = useVaultIcon(vaultPath)
  const saveIconMutation = useSaveVaultIcon()

  const vaultName = vaultPath?.split(/[/\\]/).pop() || null

  useEffect(() => {
    if (isSettingsOpen) {
      setActiveSection(settingsSection || 'general')
    }
  }, [isSettingsOpen, settingsSection])

  useEffect(() => {
    if (isSettingsOpen) {
      setLocalAppName(settings.appName)
    }
  }, [isSettingsOpen, settings.appName])

  const handleAppNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalAppName(e.target.value)
    },
    []
  )

  const handleAppNameBlur = useCallback(() => {
    if (localAppName.trim() && localAppName !== settings.appName) {
      updateAppName(localAppName.trim())
    }
  }, [localAppName, settings.appName, updateAppName])

  const handleColorSelect = useCallback(
    (color: string) => {
      updateAccentColor(color)
    },
    [updateAccentColor]
  )

  const handleIconSelect = useCallback(
    (icon: string) => {
      if (vaultPath) {
        saveIconMutation.mutate({ vaultPath, icon })
      }
    },
    [vaultPath, saveIconMutation]
  )

  const handleRemoveVault = useCallback(
    async (path: string) => {
      await removeKnownVault(path)
      queryClient.invalidateQueries({ queryKey: vaultKeys.list() })
    },
    [queryClient]
  )

  const handleAddVault = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select Vault Folder'
    })

    if (selected && typeof selected === 'string') {
      await selectVault(selected)
      closeSettings()
    }
  }, [selectVault, closeSettings])

  const handleSwitchVault = useCallback(
    (path: string) => {
      switchVault(path)
      closeSettings()
    },
    [switchVault, closeSettings]
  )

  return (
    <Dialog
      open={isSettingsOpen}
      onOpenChange={(open) => !open && closeSettings()}
    >
      <DialogContent
        className="w-full max-w-4xl p-0 gap-0 bg-surface border-border overflow-hidden"
        showCloseButton={false}
      >
        <DialogHeader className="px-4 py-3 border-b border-border/50 flex-row items-center justify-between">
          <DialogTitle className="text-base font-semibold">
            Settings
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={closeSettings}
          >
            <X size={16} />
          </Button>
        </DialogHeader>

        <div className="flex min-h-[400px] max-h-[70vh]">
          <SettingsNav
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />

          <div className="flex-1 p-6 overflow-y-auto">
            {activeSection === 'general' && (
              <GeneralSettings
                appName={localAppName}
                onAppNameChange={handleAppNameChange}
                onAppNameBlur={handleAppNameBlur}
              />
            )}
            {activeSection === 'storage' && (
              <StorageSettings
                vaultPath={vaultPath}
                knownVaults={knownVaults}
                vaultIcons={vaultIcons}
                onAddVault={handleAddVault}
                onSwitchVault={handleSwitchVault}
                onRemoveVault={handleRemoveVault}
              />
            )}
            {activeSection === 'appearance' && (
              <AppearanceSettings
                accentColor={settings.accentColor}
                vaultIcon={currentVaultIcon}
                showColorPicker={showColorPicker}
                onToggleColorPicker={() => setShowColorPicker(!showColorPicker)}
                onColorSelect={handleColorSelect}
                onIconSelect={handleIconSelect}
                onApplyToAllVaults={updateAccentColorForAllVaults}
                vaultName={vaultName}
              />
            )}
            {activeSection === 'advanced' && <AdvancedSettings />}
            {activeSection === 'about' && (
              <AboutSettings appName={settings.appName} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface SettingsNavProps {
  activeSection: SettingsSection
  onSectionChange: (section: SettingsSection) => void
}

function SettingsNav({ activeSection, onSectionChange }: SettingsNavProps) {
  return (
    <nav className="w-44 border-r border-border/50 p-2 flex flex-col gap-0.5 bg-[#050505] shrink-0">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          onClick={() => onSectionChange(item.id)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left',
            activeSection === item.id
              ? 'bg-brand/20 text-brand'
              : 'text-textMuted hover:text-textMain hover:bg-surfaceHighlight/50'
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  )
}
