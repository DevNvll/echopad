import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  Settings,
  Palette,
  Info,
  X,
  HardDrive,
  Wrench,
  Cloud,
  Bug
} from 'lucide-react'
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
  AdvancedSettings,
  DevSettings
} from './settings'
import { SyncSettings } from './sync/SyncSettings'
import { useVaultStore, useUIStore } from '../stores'
import {
  useKnownVaults,
  useVaultIcons,
  useVaultIcon,
  useSaveVaultIcon,
  vaultKeys,
  useDevMode
} from '../hooks'

export type SettingsSection =
  | 'general'
  | 'storage'
  | 'appearance'
  | 'sync'
  | 'advanced'
  | 'about'
  | 'dev'

interface NavItem {
  id: SettingsSection
  label: string
  icon: React.ReactNode
  devOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { id: 'general', label: 'General', icon: <Settings size={16} /> },
  { id: 'storage', label: 'Storage', icon: <HardDrive size={16} /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
  { id: 'sync', label: 'Sync', icon: <Cloud size={16} /> },
  { id: 'advanced', label: 'Advanced', icon: <Wrench size={16} /> },
  { id: 'about', label: 'About', icon: <Info size={16} /> },
  { id: 'dev', label: 'Developer', icon: <Bug size={16} />, devOnly: true }
]

export function SettingsModal() {
  const { vaultPath, selectVault, switchVault } = useVaultStore()
  const { isSettingsOpen, settingsSection, closeSettings } = useUIStore()
  const queryClient = useQueryClient()
  const { isDevMode } = useDevMode()

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

  // Filter nav items based on dev mode
  const filteredNavItems = useMemo(() => {
    return NAV_ITEMS.filter((item) => !item.devOnly || isDevMode)
  }, [isDevMode])

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

        <div className="flex min-h-[400px] max-h-[70vh] overflow-hidden">
          <SettingsNav
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            navItems={filteredNavItems}
          />

          <div className="flex-1 p-6 overflow-y-auto overflow-x-hidden min-w-0">
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
            {activeSection === 'sync' && <SyncSettings />}
            {activeSection === 'advanced' && <AdvancedSettings />}
            {activeSection === 'about' && (
              <AboutSettings appName={settings.appName} />
            )}
            {activeSection === 'dev' && isDevMode && <DevSettings />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface SettingsNavProps {
  activeSection: SettingsSection
  onSectionChange: (section: SettingsSection) => void
  navItems: NavItem[]
}

function SettingsNav({
  activeSection,
  onSectionChange,
  navItems
}: SettingsNavProps) {
  return (
    <nav className="w-44 border-r border-border/50 p-2 flex flex-col gap-0.5 bg-[#050505] shrink-0">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onSectionChange(item.id)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left',
            activeSection === item.id
              ? 'bg-brand/20 text-brand'
              : 'text-textMuted hover:text-textMain hover:bg-surfaceHighlight/50',
            item.devOnly && 'text-amber-400/70 hover:text-amber-400'
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  )
}
