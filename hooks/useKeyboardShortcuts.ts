import { useEffect } from 'react'
import { useKeybindsStore } from '../stores'

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
  const { matchesKeybind, isLoaded } = useKeybindsStore()

  useEffect(() => {
    if (!isLoaded) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape / Close Modal
      if (matchesKeybind('closeModal', e)) {
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

      // Advanced Search
      if (matchesKeybind('advancedSearch', e)) {
        e.preventDefault()
        onOpenSearch()
        return
      }

      // Settings
      if (matchesKeybind('settings', e)) {
        e.preventDefault()
        if (isSettingsOpen) {
          onToggleSettings()
        } else {
          onOpenSettings()
        }
        return
      }

      // Command Palette
      if (matchesKeybind('commandPalette', e)) {
        // Allow Ctrl+K for navigation when command palette is open
        if (isCommandOpen && e.ctrlKey && !e.metaKey) {
          return
        }
        e.preventDefault()
        onToggleCommand()
        return
      }

      // Toggle Sidebar
      if (matchesKeybind('toggleSidebar', e)) {
        e.preventDefault()
        onToggleSidebar()
        return
      }

      // New Note
      if (matchesKeybind('newNote', e)) {
        e.preventDefault()
        if (hasActiveNotebook) {
          onFocusInput()
        } else {
          onRestoreAndFocusInput()
        }
        return
      }

      // New Notebook
      if (matchesKeybind('newNotebook', e)) {
        e.preventDefault()
        onCreateNotebook()
        return
      }

      // Block browser shortcuts
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        const key = e.key.toLowerCase()
        if (key === 'f') {
          e.preventDefault()
          onOpenSearch()
          return
        }
        if (key === 'p' || key === 'g') {
          e.preventDefault()
          return
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    isLoaded,
    matchesKeybind,
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
