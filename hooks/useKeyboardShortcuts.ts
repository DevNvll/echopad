import { useEffect } from 'react'

interface UseKeyboardShortcutsOptions {
  isCommandOpen: boolean
  isSettingsOpen: boolean
  onToggleCommand: () => void
  onToggleSettings: () => void
  onOpenSettings: () => void
}

export function useKeyboardShortcuts({
  isCommandOpen,
  isSettingsOpen,
  onToggleCommand,
  onToggleSettings,
  onOpenSettings
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (!isSettingsOpen) {
          onOpenSettings()
        }
        onToggleSettings()
        return
      }
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        if (isCommandOpen && e.ctrlKey && !e.metaKey) {
          return
        }
        e.preventDefault()
        onToggleCommand()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isCommandOpen, isSettingsOpen, onToggleCommand, onToggleSettings, onOpenSettings])
}

