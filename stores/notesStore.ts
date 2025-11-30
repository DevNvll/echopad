import { create } from 'zustand'
import { Note } from '../types'
import {
  listNotes,
  readNote,
  createNote as apiCreateNote,
  updateNote as apiUpdateNote,
  deleteNote as apiDeleteNote,
  getRecentNotes,
  getTotalNotesCount
} from '../api'

interface NotesState {
  notes: Note[]
  recentNotes: Note[]
  totalNotesCount: number
  isLoading: boolean
  editingMessageId: string | null
  targetMessageId: string | null

  loadNotes: (vaultPath: string, notebookPath: string) => Promise<void>
  loadRecentNotes: (vaultPath: string) => Promise<void>
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
  setEditing: (messageId: string | null) => void
  setTarget: (messageId: string | null) => void
  clearTarget: () => void
  clearNotes: () => void
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  recentNotes: [],
  totalNotesCount: 0,
  isLoading: false,
  editingMessageId: null,
  targetMessageId: null,

  loadNotes: async (vaultPath, notebookPath) => {
    set({ isLoading: true })
    try {
      const metadata = await listNotes(vaultPath, notebookPath)
      const loadedNotes: Note[] = []
      for (const meta of metadata) {
        const note = await readNote(vaultPath, notebookPath, meta.filename)
        loadedNotes.push(note)
      }
      set({ notes: loadedNotes })
    } catch (err) {
      console.error('Failed to load notes:', err)
      set({ notes: [] })
    } finally {
      set({ isLoading: false })
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
      notes: state.notes.filter((n) => n.filename !== filename)
    }))
  },

  setEditing: (messageId) => set({ editingMessageId: messageId }),
  setTarget: (messageId) => set({ targetMessageId: messageId }),
  clearTarget: () => set({ targetMessageId: null }),
  clearNotes: () => set({ notes: [], isLoading: false })
}))

