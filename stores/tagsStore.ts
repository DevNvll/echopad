import { create } from 'zustand'
import { Note } from '../types'
import {
  syncVaultTags,
  syncNoteTags,
  removeNoteTags as apiRemoveNoteTags,
  getAllTags,
  TagWithCount
} from '../api'

interface TagsState {
  allTags: TagWithCount[]
  isLoaded: boolean

  loadTags: (vaultPath: string) => Promise<void>
  syncNoteTags: (note: Note) => Promise<void>
  removeNoteTags: (filename: string, notebookPath: string) => Promise<void>
  refreshTags: () => Promise<void>
}

export const useTagsStore = create<TagsState>((set) => ({
  allTags: [],
  isLoaded: false,

  loadTags: async (vaultPath) => {
    await syncVaultTags(vaultPath)
    const tags = await getAllTags()
    set({ allTags: tags, isLoaded: true })
  },

  syncNoteTags: async (note) => {
    await syncNoteTags(note)
    const tags = await getAllTags()
    set({ allTags: tags })
  },

  removeNoteTags: async (filename, notebookPath) => {
    await apiRemoveNoteTags(filename, notebookPath)
    const tags = await getAllTags()
    set({ allTags: tags })
  },

  refreshTags: async () => {
    const tags = await getAllTags()
    set({ allTags: tags })
  }
}))




