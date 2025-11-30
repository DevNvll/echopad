import { create } from 'zustand'
import { Notebook, Note } from '../types'
import { SettingsSection } from '../components/SettingsModal'

interface ContextMenu {
  x: number
  y: number
  type: 'notebook' | 'message'
  data: Notebook | Note
}

interface UIState {
  isCommandOpen: boolean
  commandInitialSearch: string

  isSettingsOpen: boolean
  settingsSection: SettingsSection

  contextMenu: ContextMenu | null

  isCreateModalOpen: boolean
  isEditModalOpen: boolean
  isDeleteModalOpen: boolean
  targetNotebook: Notebook | null
  parentNotebook: Notebook | null

  openCommand: (initialSearch?: string) => void
  closeCommand: () => void
  toggleCommand: () => void

  openSettings: (section?: SettingsSection) => void
  closeSettings: () => void
  toggleSettings: () => void
  setSettingsSection: (section: SettingsSection) => void

  openContextMenu: (menu: ContextMenu) => void
  closeContextMenu: () => void

  openCreateModal: (parent?: Notebook | null) => void
  closeCreateModal: () => void
  openEditModal: (notebook: Notebook) => void
  closeEditModal: () => void
  openDeleteModal: (notebook: Notebook) => void
  closeDeleteModal: () => void
  closeAllModals: () => void
}

export const useUIStore = create<UIState>((set, get) => ({
  isCommandOpen: false,
  commandInitialSearch: '',

  isSettingsOpen: false,
  settingsSection: 'general',

  contextMenu: null,

  isCreateModalOpen: false,
  isEditModalOpen: false,
  isDeleteModalOpen: false,
  targetNotebook: null,
  parentNotebook: null,

  openCommand: (initialSearch = '') =>
    set({ isCommandOpen: true, commandInitialSearch: initialSearch }),
  closeCommand: () => set({ isCommandOpen: false, commandInitialSearch: '' }),
  toggleCommand: () =>
    set((state) => ({
      isCommandOpen: !state.isCommandOpen,
      commandInitialSearch: state.isCommandOpen
        ? ''
        : state.commandInitialSearch
    })),

  openSettings: (section = 'general') =>
    set({ isSettingsOpen: true, settingsSection: section }),
  closeSettings: () => set({ isSettingsOpen: false }),
  toggleSettings: () =>
    set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
  setSettingsSection: (section) => set({ settingsSection: section }),

  openContextMenu: (menu) => set({ contextMenu: menu }),
  closeContextMenu: () => set({ contextMenu: null }),

  openCreateModal: (parent = null) =>
    set({ isCreateModalOpen: true, parentNotebook: parent }),
  closeCreateModal: () =>
    set({ isCreateModalOpen: false, parentNotebook: null }),
  openEditModal: (notebook) =>
    set({ isEditModalOpen: true, targetNotebook: notebook }),
  closeEditModal: () => set({ isEditModalOpen: false, targetNotebook: null }),
  openDeleteModal: (notebook) =>
    set({ isDeleteModalOpen: true, targetNotebook: notebook }),
  closeDeleteModal: () =>
    set({ isDeleteModalOpen: false, targetNotebook: null }),
  closeAllModals: () =>
    set({
      isCommandOpen: false,
      commandInitialSearch: '',
      isSettingsOpen: false,
      isCreateModalOpen: false,
      isEditModalOpen: false,
      isDeleteModalOpen: false,
      targetNotebook: null,
      parentNotebook: null,
      contextMenu: null
    })
}))
