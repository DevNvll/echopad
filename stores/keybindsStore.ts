import { create } from 'zustand'
import { getSetting, saveSetting } from '../api'

export type KeybindAction =
  | 'commandPalette'
  | 'advancedSearch'
  | 'settings'
  | 'toggleSidebar'
  | 'newNote'
  | 'newNotebook'
  | 'closeModal'

export interface Keybind {
  action: KeybindAction
  label: string
  description: string
  keys: string[]
}

export const DEFAULT_KEYBINDS: Record<KeybindAction, Keybind> = {
  commandPalette: {
    action: 'commandPalette',
    label: 'Command Palette',
    description: 'Open the command palette for quick actions',
    keys: ['Ctrl', 'K']
  },
  advancedSearch: {
    action: 'advancedSearch',
    label: 'Advanced Search',
    description: 'Open the advanced search view',
    keys: ['Ctrl', 'Shift', 'F']
  },
  settings: {
    action: 'settings',
    label: 'Settings',
    description: 'Open settings',
    keys: ['Ctrl', ',']
  },
  toggleSidebar: {
    action: 'toggleSidebar',
    label: 'Toggle Sidebar',
    description: 'Show or hide the sidebar',
    keys: ['Ctrl', 'B']
  },
  newNote: {
    action: 'newNote',
    label: 'New Note',
    description: 'Focus input to create a new note',
    keys: ['Ctrl', 'N']
  },
  newNotebook: {
    action: 'newNotebook',
    label: 'New Notebook',
    description: 'Create a new notebook',
    keys: ['Ctrl', 'Shift', 'N']
  },
  closeModal: {
    action: 'closeModal',
    label: 'Close / Back',
    description: 'Close dialogs or go back from search',
    keys: ['Escape']
  }
}

interface KeybindsState {
  keybinds: Record<KeybindAction, Keybind>
  isLoaded: boolean

  loadKeybinds: () => Promise<void>
  updateKeybind: (action: KeybindAction, keys: string[]) => Promise<void>
  resetKeybind: (action: KeybindAction) => Promise<void>
  resetAllKeybinds: () => Promise<void>
  matchesKeybind: (action: KeybindAction, e: KeyboardEvent) => boolean
}

function normalizeKey(key: string): string {
  const lower = key.toLowerCase()
  if (lower === 'control') return 'ctrl'
  if (lower === 'meta' || lower === 'command' || lower === 'cmd') return 'ctrl'
  if (lower === ' ') return 'space'
  if (lower === 'arrowup') return 'up'
  if (lower === 'arrowdown') return 'down'
  if (lower === 'arrowleft') return 'left'
  if (lower === 'arrowright') return 'right'
  return lower
}

export const useKeybindsStore = create<KeybindsState>((set, get) => ({
  keybinds: { ...DEFAULT_KEYBINDS },
  isLoaded: false,

  loadKeybinds: async () => {
    const saved = await getSetting<Record<KeybindAction, string[]> | null>(
      'customKeybinds',
      null
    )

    if (saved) {
      const merged = { ...DEFAULT_KEYBINDS }
      for (const [action, keys] of Object.entries(saved)) {
        if (merged[action as KeybindAction]) {
          merged[action as KeybindAction] = {
            ...merged[action as KeybindAction],
            keys
          }
        }
      }
      set({ keybinds: merged, isLoaded: true })
    } else {
      set({ isLoaded: true })
    }
  },

  updateKeybind: async (action, keys) => {
    const current = get().keybinds
    const updated = {
      ...current,
      [action]: { ...current[action], keys }
    }
    set({ keybinds: updated })

    const toSave: Record<string, string[]> = {}
    for (const [key, keybind] of Object.entries(updated)) {
      toSave[key] = keybind.keys
    }
    await saveSetting('customKeybinds', toSave)
  },

  resetKeybind: async (action) => {
    const current = get().keybinds
    const updated = {
      ...current,
      [action]: { ...DEFAULT_KEYBINDS[action] }
    }
    set({ keybinds: updated })

    const toSave: Record<string, string[]> = {}
    for (const [key, keybind] of Object.entries(updated)) {
      toSave[key] = keybind.keys
    }
    await saveSetting('customKeybinds', toSave)
  },

  resetAllKeybinds: async () => {
    set({ keybinds: { ...DEFAULT_KEYBINDS } })
    await saveSetting('customKeybinds', null)
  },

  matchesKeybind: (action, e) => {
    const keybind = get().keybinds[action]
    if (!keybind) return false

    const keys = keybind.keys.map((k) => normalizeKey(k))
    const pressedKey = normalizeKey(e.key)

    const needsCtrl = keys.includes('ctrl')
    const needsShift = keys.includes('shift')
    const needsAlt = keys.includes('alt')

    const hasCtrl = e.ctrlKey || e.metaKey
    const hasShift = e.shiftKey
    const hasAlt = e.altKey

    if (needsCtrl !== hasCtrl) return false
    if (needsShift !== hasShift) return false
    if (needsAlt !== hasAlt) return false

    const mainKey = keys.find(
      (k) => !['ctrl', 'shift', 'alt', 'meta'].includes(k)
    )
    if (!mainKey) return false

    return pressedKey === mainKey
  }
}))

