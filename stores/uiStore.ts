import { create } from 'zustand'
import { Notebook, Note, BoardMetadata } from '../types'
import { SettingsSection } from '../components/SettingsModal'

interface ContextMenu {
  x: number
  y: number
  type: 'notebook' | 'message' | 'board'
  data: Notebook | Note | BoardMetadata
}

interface UIState {
  isCommandOpen: boolean
  commandInitialSearch: string

  isSettingsOpen: boolean
  settingsSection: SettingsSection

  isMediaSheetOpen: boolean

  contextMenu: ContextMenu | null

  isCreateModalOpen: boolean
  isEditModalOpen: boolean
  isDeleteModalOpen: boolean
  isCreateBoardModalOpen: boolean
  isEditBoardModalOpen: boolean
  targetNotebook: Notebook | null
  parentNotebook: Notebook | null
  targetBoard: BoardMetadata | null

  openCommand: (initialSearch?: string) => void
  closeCommand: () => void
  toggleCommand: () => void

  openSettings: (section?: SettingsSection) => void
  closeSettings: () => void
  toggleSettings: () => void
  setSettingsSection: (section: SettingsSection) => void

  openMediaSheet: () => void
  closeMediaSheet: () => void
  toggleMediaSheet: () => void

  openContextMenu: (menu: ContextMenu) => void
  closeContextMenu: () => void

  openCreateModal: (parent?: Notebook | null) => void
  closeCreateModal: () => void
  openEditModal: (notebook: Notebook) => void
  closeEditModal: () => void
  openDeleteModal: (notebook: Notebook) => void
  closeDeleteModal: () => void
  openCreateBoardModal: () => void
  closeCreateBoardModal: () => void
  openEditBoardModal: (board: BoardMetadata) => void
  closeEditBoardModal: () => void
  closeAllModals: () => void
}

export const useUIStore = create<UIState>((set) => ({
  isCommandOpen: false,
  commandInitialSearch: '',

  isSettingsOpen: false,
  settingsSection: 'general',

  isMediaSheetOpen: false,

  contextMenu: null,

  isCreateModalOpen: false,
  isEditModalOpen: false,
  isDeleteModalOpen: false,
  isCreateBoardModalOpen: false,
  isEditBoardModalOpen: false,
  targetNotebook: null,
  parentNotebook: null,
  targetBoard: null,

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

  openMediaSheet: () => set({ isMediaSheetOpen: true }),
  closeMediaSheet: () => set({ isMediaSheetOpen: false }),
  toggleMediaSheet: () =>
    set((state) => ({ isMediaSheetOpen: !state.isMediaSheetOpen })),

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
  openCreateBoardModal: () => set({ isCreateBoardModalOpen: true }),
  closeCreateBoardModal: () => set({ isCreateBoardModalOpen: false }),
  openEditBoardModal: (board) =>
    set({ isEditBoardModalOpen: true, targetBoard: board }),
  closeEditBoardModal: () =>
    set({ isEditBoardModalOpen: false, targetBoard: null }),
  closeAllModals: () =>
    set({
      isCommandOpen: false,
      commandInitialSearch: '',
      isSettingsOpen: false,
      isMediaSheetOpen: false,
      isCreateModalOpen: false,
      isEditModalOpen: false,
      isDeleteModalOpen: false,
      isCreateBoardModalOpen: false,
      isEditBoardModalOpen: false,
      targetNotebook: null,
      parentNotebook: null,
      targetBoard: null,
      contextMenu: null
    })
}))
