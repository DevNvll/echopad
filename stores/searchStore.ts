import { create } from 'zustand'
import { Note } from '../types'
import { advancedSearchNotes, getSetting, saveSetting } from '../api'

export interface SearchFilterState {
  dateRange: { from: Date | null; to: Date | null }
  selectedTags: string[]
  selectedNotebooks: string[]
  hasLink: boolean | null
  hasImage: boolean | null
}

export interface RecentSearch {
  query: string
  timestamp: number
}

const initialFilters: SearchFilterState = {
  dateRange: { from: null, to: null },
  selectedTags: [],
  selectedNotebooks: [],
  hasLink: null,
  hasImage: null
}

const PAGE_SIZE = 50
const MAX_RECENT_SEARCHES = 10

interface SearchState {
  query: string
  filters: SearchFilterState
  results: Note[]
  isSearching: boolean
  isLoadingMore: boolean
  hasSearched: boolean
  hasMore: boolean
  currentPage: number
  recentSearches: RecentSearch[]

  setQuery: (query: string) => void
  setFilters: (filters: SearchFilterState) => void
  updateFilter: <K extends keyof SearchFilterState>(
    key: K,
    value: SearchFilterState[K]
  ) => void
  clearFilters: () => void
  performSearch: (vaultPath: string) => Promise<void>
  loadMore: (vaultPath: string) => Promise<void>
  resetSearch: () => void
  loadRecentSearches: () => Promise<void>
  addRecentSearch: (query: string) => Promise<void>
  removeRecentSearch: (query: string) => Promise<void>
  clearRecentSearches: () => Promise<void>
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  filters: initialFilters,
  results: [],
  isSearching: false,
  isLoadingMore: false,
  hasSearched: false,
  hasMore: false,
  currentPage: 0,
  recentSearches: [],

  setQuery: (query) => set({ query }),

  setFilters: (filters) => set({ filters }),

  updateFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value }
    })),

  clearFilters: () => set({ filters: initialFilters }),

  performSearch: async (vaultPath) => {
    const { query, filters } = get()

    const hasActiveFilters =
      filters.dateRange.from !== null ||
      filters.dateRange.to !== null ||
      filters.selectedTags.length > 0 ||
      filters.selectedNotebooks.length > 0 ||
      filters.hasLink !== null ||
      filters.hasImage !== null

    if (!query.trim() && !hasActiveFilters) {
      set({ results: [], hasSearched: false, hasMore: false, currentPage: 0 })
      return
    }

    set({ isSearching: true, hasSearched: true, currentPage: 0 })

    try {
      const searchResults = await advancedSearchNotes(vaultPath, {
        query,
        dateFrom: filters.dateRange.from,
        dateTo: filters.dateRange.to,
        tags: filters.selectedTags,
        notebooks: filters.selectedNotebooks,
        hasLink: filters.hasLink,
        hasImage: filters.hasImage,
        limit: PAGE_SIZE,
        offset: 0
      })
      set({
        results: searchResults,
        hasMore: searchResults.length === PAGE_SIZE,
        currentPage: 1
      })
    } catch (error) {
      console.error('Search failed:', error)
      set({ results: [], hasMore: false })
    } finally {
      set({ isSearching: false })
    }
  },

  loadMore: async (vaultPath) => {
    const { query, filters, results, currentPage, hasMore, isLoadingMore } =
      get()

    if (!hasMore || isLoadingMore) return

    set({ isLoadingMore: true })

    try {
      const moreResults = await advancedSearchNotes(vaultPath, {
        query,
        dateFrom: filters.dateRange.from,
        dateTo: filters.dateRange.to,
        tags: filters.selectedTags,
        notebooks: filters.selectedNotebooks,
        hasLink: filters.hasLink,
        hasImage: filters.hasImage,
        limit: PAGE_SIZE,
        offset: currentPage * PAGE_SIZE
      })
      set({
        results: [...results, ...moreResults],
        hasMore: moreResults.length === PAGE_SIZE,
        currentPage: currentPage + 1
      })
    } catch (error) {
      console.error('Load more failed:', error)
    } finally {
      set({ isLoadingMore: false })
    }
  },

  resetSearch: () =>
    set({
      query: '',
      filters: initialFilters,
      results: [],
      isSearching: false,
      isLoadingMore: false,
      hasSearched: false,
      hasMore: false,
      currentPage: 0
    }),

  loadRecentSearches: async () => {
    const searches = await getSetting<RecentSearch[]>('recentSearches', [])
    set({ recentSearches: searches })
  },

  addRecentSearch: async (query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return

    const { recentSearches } = get()
    const filtered = recentSearches.filter((s) => s.query !== trimmed)
    const newSearches: RecentSearch[] = [
      { query: trimmed, timestamp: Date.now() },
      ...filtered
    ].slice(0, MAX_RECENT_SEARCHES)

    set({ recentSearches: newSearches })
    await saveSetting('recentSearches', newSearches)
  },

  removeRecentSearch: async (query: string) => {
    const { recentSearches } = get()
    const filtered = recentSearches.filter((s) => s.query !== query)
    set({ recentSearches: filtered })
    await saveSetting('recentSearches', filtered)
  },

  clearRecentSearches: async () => {
    set({ recentSearches: [] })
    await saveSetting('recentSearches', [])
  }
}))

