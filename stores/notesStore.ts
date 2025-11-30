import { create } from 'zustand'
import { Note, NoteMetadata } from '../types'
import {
  listNotes,
  readNote,
  createNote as apiCreateNote,
  updateNote as apiUpdateNote,
  deleteNote as apiDeleteNote,
  getRecentNotes,
  getTotalNotesCount,
  toggleNoteFavorite as apiToggleNoteFavorite,
  getFavoriteNotes as apiGetFavoriteNotes,
  isNoteFavorite
} from '../api'

const PAGE_SIZE = 100

interface NotesState {
  notes: Note[]
  recentNotes: Note[]
  favoriteNotes: Note[]
  totalNotesCount: number
  isLoading: boolean
  isLoadingMore: boolean
  editingMessageId: string | null
  targetMessageId: string | null
  // Pagination state
  allMetadata: NoteMetadata[]
  currentPage: number
  hasMore: boolean

  loadNotes: (vaultPath: string, notebookPath: string) => Promise<void>
  loadMoreNotes: (vaultPath: string, notebookPath: string) => Promise<void>
  loadRecentNotes: (vaultPath: string) => Promise<void>
  loadFavoriteNotes: (vaultPath: string) => Promise<void>
  loadTotalNotesCount: (vaultPath: string) => Promise<void>
  createNote: (
    vaultPath: string,
    notebookPath: string,
    content: string
  ) => Promise<Note>
  updateNote: (
    vaultPath: string,
    notebookPath: string,
    filename: string,
    content: string
  ) => Promise<Note>
  deleteNote: (
    vaultPath: string,
    notebookPath: string,
    filename: string
  ) => Promise<void>
  toggleFavorite: (filename: string, notebookPath: string) => Promise<boolean>
  setEditing: (messageId: string | null) => void
  setTarget: (messageId: string | null) => void
  clearTarget: () => void
  clearNotes: () => void
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  recentNotes: [],
  favoriteNotes: [],
  totalNotesCount: 0,
  isLoading: false,
  isLoadingMore: false,
  editingMessageId: null,
  targetMessageId: null,
  allMetadata: [],
  currentPage: 0,
  hasMore: false,

  loadNotes: async (vaultPath, notebookPath) => {
    set({ isLoading: true, currentPage: 0, hasMore: false, allMetadata: [] })
    try {
      const metadata = await listNotes(vaultPath, notebookPath)
      const sortedMetadata = [...metadata].sort(
        (a, b) => a.createdAt - b.createdAt
      )
      const totalCount = sortedMetadata.length
      const startIndex = Math.max(0, totalCount - PAGE_SIZE)
      const initialMetadata = sortedMetadata.slice(startIndex)

      const loadedNotes: Note[] = []
      for (const meta of initialMetadata) {
        const note = await readNote(vaultPath, notebookPath, meta.filename)
        const isFavorite = await isNoteFavorite(meta.filename, notebookPath)
        loadedNotes.push({ ...note, isFavorite })
      }

      set({
        notes: loadedNotes,
        allMetadata: sortedMetadata,
        currentPage: 1,
        hasMore: startIndex > 0
      })
    } catch (err) {
      console.error('Failed to load notes:', err)
      set({ notes: [], allMetadata: [], currentPage: 0, hasMore: false })
    } finally {
      set({ isLoading: false })
    }
  },

  loadMoreNotes: async (vaultPath, notebookPath) => {
    const { allMetadata, currentPage, hasMore, isLoadingMore, notes } = get()
    if (!hasMore || isLoadingMore) return

    set({ isLoadingMore: true })
    try {
      const totalCount = allMetadata.length
      const alreadyLoaded = currentPage * PAGE_SIZE
      const endIndex = totalCount - alreadyLoaded
      const startIndex = Math.max(0, endIndex - PAGE_SIZE)
      const nextMetadata = allMetadata.slice(startIndex, endIndex)

      const olderNotes: Note[] = []
      for (const meta of nextMetadata) {
        const note = await readNote(vaultPath, notebookPath, meta.filename)
        const isFavorite = await isNoteFavorite(meta.filename, notebookPath)
        olderNotes.push({ ...note, isFavorite })
      }

      // Prepend older notes to existing notes
      set({
        notes: [...olderNotes, ...notes],
        currentPage: currentPage + 1,
        hasMore: startIndex > 0
      })
    } catch (err) {
      console.error('Failed to load more notes:', err)
    } finally {
      set({ isLoadingMore: false })
    }
  },

  loadRecentNotes: async (vaultPath) => {
    try {
      const recent = await getRecentNotes(vaultPath, 5)
      set({ recentNotes: recent })
    } catch (err) {
      console.error('Failed to load recent notes:', err)
      set({ recentNotes: [] })
    }
  },

  loadFavoriteNotes: async (vaultPath) => {
    try {
      const favorites = await apiGetFavoriteNotes(vaultPath)
      set({ favoriteNotes: favorites })
    } catch (err) {
      console.error('Failed to load favorite notes:', err)
      set({ favoriteNotes: [] })
    }
  },

  loadTotalNotesCount: async (vaultPath) => {
    try {
      const count = await getTotalNotesCount(vaultPath)
      set({ totalNotesCount: count })
    } catch (err) {
      console.error('Failed to load total notes count:', err)
      set({ totalNotesCount: 0 })
    }
  },

  createNote: async (vaultPath, notebookPath, content) => {
    const newNote = await apiCreateNote(vaultPath, notebookPath, content)
    set((state) => ({ notes: [...state.notes, newNote] }))
    return newNote
  },

  updateNote: async (vaultPath, notebookPath, filename, content) => {
    const updated = await apiUpdateNote(
      vaultPath,
      notebookPath,
      filename,
      content
    )
    set((state) => ({
      notes: state.notes.map((n) => (n.filename === filename ? updated : n)),
      editingMessageId: null
    }))
    return updated
  },

  deleteNote: async (vaultPath, notebookPath, filename) => {
    await apiDeleteNote(vaultPath, notebookPath, filename)
    set((state) => ({
      notes: state.notes.filter((n) => n.filename !== filename),
      favoriteNotes: state.favoriteNotes.filter((n) => n.filename !== filename)
    }))
  },

  toggleFavorite: async (filename, notebookPath) => {
    const isFavorite = await apiToggleNoteFavorite(filename, notebookPath)
    set((state) => ({
      notes: state.notes.map((n) =>
        n.filename === filename && n.notebookName === notebookPath
          ? { ...n, isFavorite }
          : n
      ),
      favoriteNotes: isFavorite
        ? state.favoriteNotes
        : state.favoriteNotes.filter(
            (n) => n.filename !== filename || n.notebookName !== notebookPath
          )
    }))
    return isFavorite
  },

  setEditing: (messageId) => set({ editingMessageId: messageId }),
  setTarget: (messageId) => set({ targetMessageId: messageId }),
  clearTarget: () => set({ targetMessageId: null }),
  clearNotes: () =>
    set({
      notes: [],
      isLoading: false,
      isLoadingMore: false,
      allMetadata: [],
      currentPage: 0,
      hasMore: false
    })
}))
