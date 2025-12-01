import { create } from 'zustand'
import { Notebook } from '../types'
import {
  listNotebooks,
  createNotebook as apiCreateNotebook,
  renameNotebook,
  deleteNotebook as apiDeleteNotebook,
  toggleNotebookPin,
  saveSetting,
  getSetting,
  getPinnedOrder,
  updatePinnedOrder,
  getNotebookOrder,
  updateNotebookOrder
} from '../api'

interface NotebookState {
  notebooks: Notebook[]
  activeNotebook: string | null
  isLoaded: boolean
  pinnedOrder: string[]
  notebookOrder: string[]

  loadNotebooks: (vaultPath: string) => Promise<void>
  selectNotebook: (relativePath: string) => void
  createNotebook: (
    vaultPath: string,
    name: string,
    parentPath?: string
  ) => Promise<Notebook>
  updateNotebook: (
    vaultPath: string,
    relativePath: string,
    newName: string
  ) => Promise<Notebook>
  deleteNotebook: (vaultPath: string, relativePath: string) => Promise<void>
  togglePin: (notebook: Notebook) => Promise<void>
  restoreLastActiveNotebook: () => Promise<void>
  setActiveNotebook: (relativePath: string | null) => void
  reorderPinnedNotebooks: (newOrder: string[]) => Promise<void>
  reorderNotebooks: (newOrder: string[]) => Promise<void>

  allNotebooks: () => Notebook[]
  currentNotebook: () => Notebook | undefined
  notebookMap: () => Record<string, string>
  sortedPinnedNotebooks: () => Notebook[]
  sortedTopLevelNotebooks: () => Notebook[]
}

const flattenNotebooks = (nbs: Notebook[]): Notebook[] => {
  const result: Notebook[] = []
  for (const nb of nbs) {
    result.push(nb)
    if (nb.children) {
      result.push(...flattenNotebooks(nb.children))
    }
  }
  return result
}

const updateNotebookInTree = (
  nbs: Notebook[],
  targetPath: string,
  updater: (nb: Notebook) => Notebook
): Notebook[] => {
  return nbs.map((nb) => {
    if (nb.relativePath === targetPath) {
      return updater(nb)
    }
    if (nb.children) {
      return {
        ...nb,
        children: updateNotebookInTree(nb.children, targetPath, updater)
      }
    }
    return nb
  })
}

export const useNotebookStore = create<NotebookState>((set, get) => ({
  notebooks: [],
  activeNotebook: null,
  isLoaded: false,
  pinnedOrder: [],
  notebookOrder: [],

  loadNotebooks: async (vaultPath: string) => {
    const nbs = await listNotebooks(vaultPath)
    const pinnedOrderMap = await getPinnedOrder()
    const notebookOrderMap = await getNotebookOrder()

    // Extract sorted pinned paths
    const pinnedPaths = Object.entries(pinnedOrderMap)
      .sort(([, a], [, b]) => a - b)
      .map(([path]) => path)

    // Extract sorted notebook paths (top-level only for now)
    const notebookPaths = Object.entries(notebookOrderMap)
      .sort(([, a], [, b]) => a - b)
      .map(([path]) => path)

    set({
      notebooks: nbs,
      isLoaded: true,
      pinnedOrder: pinnedPaths,
      notebookOrder: notebookPaths
    })
  },

  selectNotebook: (relativePath: string) => {
    set({ activeNotebook: relativePath })
    saveSetting('lastActiveNotebook', relativePath)
  },

  createNotebook: async (vaultPath, name, parentPath) => {
    const formattedName = name.trim().toLowerCase().replace(/\s+/g, '-')
    const nb = await apiCreateNotebook(vaultPath, formattedName, parentPath)
    const nbs = await listNotebooks(vaultPath)
    set({ notebooks: nbs, activeNotebook: nb.relativePath })
    saveSetting('lastActiveNotebook', nb.relativePath)
    return nb
  },

  updateNotebook: async (vaultPath, relativePath, newName) => {
    const formattedName = newName.trim().toLowerCase().replace(/\s+/g, '-')
    const updated = await renameNotebook(vaultPath, relativePath, formattedName)
    const nbs = await listNotebooks(vaultPath)

    const { activeNotebook } = get()
    if (activeNotebook === relativePath) {
      set({ notebooks: nbs, activeNotebook: updated.relativePath })
      saveSetting('lastActiveNotebook', updated.relativePath)
    } else {
      set({ notebooks: nbs })
    }
    return updated
  },

  deleteNotebook: async (vaultPath, relativePath) => {
    await apiDeleteNotebook(vaultPath, relativePath)
    const nbs = await listNotebooks(vaultPath)

    const { activeNotebook } = get()
    if (activeNotebook === relativePath) {
      const allNbs = flattenNotebooks(nbs)
      const remaining = allNbs.find((nb) => nb.relativePath !== relativePath)
      const newActive = remaining?.relativePath || null
      set({ notebooks: nbs, activeNotebook: newActive })
      if (newActive) saveSetting('lastActiveNotebook', newActive)
    } else {
      set({ notebooks: nbs })
    }
  },

  togglePin: async (notebook: Notebook) => {
    const isPinned = await toggleNotebookPin(notebook.relativePath)
    set((state) => ({
      notebooks: updateNotebookInTree(
        state.notebooks,
        notebook.relativePath,
        (nb) => ({ ...nb, isPinned })
      ),
      // Update pinnedOrder: add to end if pinning, remove if unpinning
      pinnedOrder: isPinned
        ? [...state.pinnedOrder, notebook.relativePath]
        : state.pinnedOrder.filter((p) => p !== notebook.relativePath)
    }))
  },

  restoreLastActiveNotebook: async () => {
    const lastNotebook = await getSetting<string | null>(
      'lastActiveNotebook',
      null
    )
    if (lastNotebook) {
      set({ activeNotebook: lastNotebook })
    }
  },

  setActiveNotebook: (relativePath) => {
    set({ activeNotebook: relativePath })
  },

  allNotebooks: () => flattenNotebooks(get().notebooks),

  currentNotebook: () => {
    const { activeNotebook } = get()
    return flattenNotebooks(get().notebooks).find(
      (nb) => nb.relativePath === activeNotebook
    )
  },

  notebookMap: () => {
    return flattenNotebooks(get().notebooks).reduce(
      (acc, nb) => {
        acc[nb.relativePath] = nb.name
        return acc
      },
      {} as Record<string, string>
    )
  },

  reorderPinnedNotebooks: async (newOrder: string[]) => {
    set({ pinnedOrder: newOrder })
    await updatePinnedOrder(newOrder)
  },

  reorderNotebooks: async (newOrder: string[]) => {
    set({ notebookOrder: newOrder })
    await updateNotebookOrder(newOrder)
  },

  sortedPinnedNotebooks: () => {
    const { notebooks, pinnedOrder } = get()
    const allNbs = flattenNotebooks(notebooks)
    const pinnedNbs = allNbs.filter((nb) => nb.isPinned)

    // Sort by pinnedOrder, then alphabetically for any not in the order
    return pinnedNbs.sort((a, b) => {
      const aIdx = pinnedOrder.indexOf(a.relativePath)
      const bIdx = pinnedOrder.indexOf(b.relativePath)
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
      if (aIdx !== -1) return -1
      if (bIdx !== -1) return 1
      return a.name.localeCompare(b.name)
    })
  },

  sortedTopLevelNotebooks: () => {
    const { notebooks, notebookOrder } = get()

    // Sort top-level notebooks by notebookOrder, then alphabetically
    return [...notebooks].sort((a, b) => {
      const aIdx = notebookOrder.indexOf(a.relativePath)
      const bIdx = notebookOrder.indexOf(b.relativePath)
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
      if (aIdx !== -1) return -1
      if (bIdx !== -1) return 1
      return a.name.localeCompare(b.name)
    })
  }
}))


