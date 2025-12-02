import { useEffect } from 'react'

interface UseKeyboardShortcutsOptions {
  isCommandOpen: boolean
  isSettingsOpen: boolean
  isSearchOpen: boolean
  isAnyModalOpen: boolean
  hasActiveNotebook: boolean
  onToggleCommand: () => void
  onToggleSettings: () => void
  onOpenSettings: () => void
  onOpenSearch: () => void
  onCloseSearch: () => void
  onToggleSidebar: () => void
  onFocusInput: () => void
  onRestoreAndFocusInput: () => void
  onCreateNotebook: () => void
  onCloseModals: () => void
}

export function useKeyboardShortcuts({
  isCommandOpen,
  isSettingsOpen,
  isSearchOpen,
  isAnyModalOpen,
  hasActiveNotebook,
  onToggleCommand,
  onToggleSettings,
  onOpenSettings,
  onOpenSearch,
  onCloseSearch,
  onToggleSidebar,
  onFocusInput,
  onRestoreAndFocusInput,
  onCreateNotebook,
  onCloseModals
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape => Close any open modal/dialog
      if (e.key === 'Escape') {
        if (isSearchOpen) {
          e.preventDefault()
          onCloseSearch()
          return
        }
        if (isCommandOpen || isSettingsOpen || isAnyModalOpen) {
          e.preventDefault()
          onCloseModals()
          return
        }
      }

      // Ctrl/Cmd + Shift + F => Open Search
      if (e.key === 'f' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        onOpenSearch()
        return
      }

      // Ctrl/Cmd + , => Settings
      if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (isSettingsOpen) {
          onToggleSettings()
        } else {
          onOpenSettings()
        }
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

      // Ctrl/Cmd + N => Focus input (new note), restore last notebook if none active
      if (e.key === 'n' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault()
        if (hasActiveNotebook) {
          onFocusInput()
        } else {
          onRestoreAndFocusInput()
        }
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
    isSearchOpen,
    isAnyModalOpen,
    hasActiveNotebook,
    onToggleCommand,
    onToggleSettings,
    onOpenSettings,
    onOpenSearch,
    onCloseSearch,
    onToggleSidebar,
    onFocusInput,
    onRestoreAndFocusInput,
    onCreateNotebook,
    onCloseModals
  ])
}
