import { create } from 'zustand'
import { Notebook } from '../types'
import {
  listNotebooks,
  createNotebook as apiCreateNotebook,
  renameNotebook,
  deleteNotebook as apiDeleteNotebook,
  toggleNotebookPin,
  saveSetting,
  getSetting
} from '../api'

interface NotebookState {
  notebooks: Notebook[]
  activeNotebook: string | null
  isLoaded: boolean

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

  allNotebooks: () => Notebook[]
  currentNotebook: () => Notebook | undefined
  notebookMap: () => Record<string, string>
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

  loadNotebooks: async (vaultPath: string) => {
    const nbs = await listNotebooks(vaultPath)
    set({ notebooks: nbs, isLoaded: true })
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
      )
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
  }
}))


