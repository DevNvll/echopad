import { create } from 'zustand'

export type Route =
  | { type: 'dashboard' }
  | { type: 'notebook'; notebookPath: string }
  | { type: 'board'; boardFilename: string }
  | { type: 'search'; query?: string }
  | { type: 'empty' }

interface RouterState {
  currentRoute: Route

  navigate: (route: Route) => void
  navigateToNotebook: (notebookPath: string) => void
  navigateToBoard: (boardFilename: string) => void
  navigateToSearch: (query?: string) => void
  navigateToDashboard: () => void
  navigateToEmpty: () => void

  isRoute: (type: Route['type']) => boolean
}

export const useRouterStore = create<RouterState>((set, get) => ({
  currentRoute: { type: 'dashboard' },

  navigate: (route) => set({ currentRoute: route }),

  navigateToNotebook: (notebookPath) =>
    set({ currentRoute: { type: 'notebook', notebookPath } }),

  navigateToBoard: (boardFilename) =>
    set({ currentRoute: { type: 'board', boardFilename } }),

  navigateToSearch: (query = '') =>
    set({ currentRoute: { type: 'search', query } }),

  navigateToDashboard: () => set({ currentRoute: { type: 'dashboard' } }),

  navigateToEmpty: () => set({ currentRoute: { type: 'empty' } }),

  isRoute: (type) => get().currentRoute.type === type
}))


