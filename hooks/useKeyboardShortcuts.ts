import { useEffect } from 'react'

interface UseKeyboardShortcutsOptions {
  isCommandOpen: boolean
  isSettingsOpen: boolean
  isAnyModalOpen: boolean
  onToggleCommand: () => void
  onToggleSettings: () => void
  onOpenSettings: () => void
  onToggleSidebar: () => void
  onFocusInput: () => void
  onCreateNotebook: () => void
  onCloseModals: () => void
}

export function useKeyboardShortcuts({
  isCommandOpen,
  isSettingsOpen,
  isAnyModalOpen,
  onToggleCommand,
  onToggleSettings,
  onOpenSettings,
  onToggleSidebar,
  onFocusInput,
  onCreateNotebook,
  onCloseModals
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape => Close any open modal/dialog
      if (e.key === 'Escape') {
        if (isCommandOpen || isSettingsOpen || isAnyModalOpen) {
          e.preventDefault()
          onCloseModals()
          return
        }
      }

      // Ctrl/Cmd + , => Settings
      if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (!isSettingsOpen) {
          onOpenSettings()
        }
        onToggleSettings()
        return
      }

      // Ctrl/Cmd + K => Command Palette
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        // Allow Ctrl+K for navigation when command palette is open
        if (isCommandOpen && e.ctrlKey && !e.metaKey) {
          return
        }
        e.preventDefault()
        onToggleCommand()
        return
      }

      // Ctrl/Cmd + B => Toggle Sidebar
      if (e.key === 'b' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onToggleSidebar()
        return
      }

      // Ctrl/Cmd + N => Focus input (new note)
      if (e.key === 'n' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault()
        onFocusInput()
        return
      }

      // Ctrl/Cmd + Shift + N => Create new notebook
      if (e.key === 'N' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        onCreateNotebook()
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    isCommandOpen,
    isSettingsOpen,
    isAnyModalOpen,
    onToggleCommand,
    onToggleSettings,
    onOpenSettings,
    onToggleSidebar,
    onFocusInput,
    onCreateNotebook,
    onCloseModals
  ])
}
