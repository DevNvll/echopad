import { useEffect, useMemo, useState } from 'react'
import {
  X,
  Search,
  PanelLeft,
  PanelLeftClose,
  SlidersHorizontal
} from 'lucide-react'
import { SearchFilters } from './SearchFilters'
import { SearchResults } from './SearchResults'
import {
  useVaultStore,
  useNotebookStore,
  useNotesStore,
  useTagsStore,
  useUIStore,
  useSearchStore
} from '../../stores'
import { clsx } from 'clsx'

interface SearchPageProps {
  isSidebarCollapsed: boolean
  onToggleSidebar: () => void
}

export function SearchPage({
  isSidebarCollapsed,
  onToggleSidebar
}: SearchPageProps) {
  const { vaultPath } = useVaultStore()
  const { allNotebooks, selectNotebook } = useNotebookStore()
  const { setTarget } = useNotesStore()
  const { allTags } = useTagsStore()
  const { searchQuery, closeSearch } = useUIStore()
  const [showFilters, setShowFilters] = useState(true)

  const {
    query,
    filters,
    results,
    isSearching,
    isLoadingMore,
    hasSearched,
    hasMore,
    recentSearches,
    setQuery,
    setFilters,
    clearFilters,
    performSearch,
    loadMore,
    resetSearch,
    loadRecentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches
  } = useSearchStore()

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filters.dateRange.from || filters.dateRange.to) count++
    if (filters.selectedTags.length > 0) count++
    if (filters.selectedNotebooks.length > 0) count++
    if (filters.hasLink !== null) count++
    if (filters.hasImage !== null) count++
    return count
  }, [filters])

  useEffect(() => {
    loadRecentSearches()
  }, [loadRecentSearches])

  useEffect(() => {
    if (searchQuery) {
      setQuery(searchQuery)
    }
  }, [searchQuery, setQuery])

  useEffect(() => {
    if (!vaultPath) return
    const timer = setTimeout(async () => {
      await performSearch(vaultPath)
      if (query.trim()) {
        addRecentSearch(query)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [vaultPath, query, filters, performSearch, addRecentSearch])

  const handleClose = () => {
    resetSearch()
    closeSearch()
  }

  const handleResultClick = (note: {
    notebookName: string
    filename: string
  }) => {
    if (note.notebookName) {
      setTarget(note.filename)
      selectNotebook(note.notebookName)
      resetSearch()
      closeSearch()
    }
  }

  const notebooks = allNotebooks()

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#050505]">
      <div className="h-16 border-b border-border/40 flex items-center px-4 bg-glass backdrop-blur-md justify-between shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg text-textMuted/60 hover:text-textMain hover:bg-surfaceHighlight/50 transition-colors shrink-0"
            title={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          >
            {isSidebarCollapsed ? (
              <PanelLeft size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'p-2 rounded-lg transition-colors relative shrink-0',
              showFilters
                ? 'text-brand bg-brand/10'
                : 'text-textMuted/50 hover:text-textMain hover:bg-surfaceHighlight/50'
            )}
            title={showFilters ? 'Hide filters' : 'Show filters'}
          >
            <SlidersHorizontal size={16} />
            {activeFiltersCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-brand text-[9px] text-white flex items-center justify-center font-medium">
                {activeFiltersCount}
              </span>
            )}
          </button>

          <div className="h-6 w-px bg-border/30 shrink-0" />

          <div className="flex-1 relative max-w-xl">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted/50"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes, tags, content..."
              autoFocus
              className="w-full h-9 pl-9 pr-9 bg-surfaceHighlight/50 border border-border/50 rounded-lg text-[13px] text-textMain placeholder:text-textMuted/40 outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-textMuted/50 hover:text-textMain transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleClose}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-textMuted/60 hover:text-textMain hover:bg-surfaceHighlight/50 transition-colors"
          >
            Close
            <kbd className="h-4 px-1 flex items-center rounded border border-border/50 bg-surfaceHighlight/50 font-mono text-[9px]">
              ESC
            </kbd>
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {showFilters && (
          <div className="w-64 shrink-0 border-r border-border/30 overflow-y-auto bg-surface/20">
            <SearchFilters
              filters={filters}
              onFiltersChange={setFilters}
              tags={allTags}
              notebooks={notebooks}
              onClearFilters={clearFilters}
              activeCount={activeFiltersCount}
            />
          </div>
        )}

        <div className="flex-1 min-w-0 overflow-hidden">
          <SearchResults
            results={results}
            isSearching={isSearching}
            isLoadingMore={isLoadingMore}
            hasSearched={hasSearched}
            hasMore={hasMore}
            query={query}
            recentSearches={recentSearches}
            onResultClick={handleResultClick}
            onTagClick={(tag) => setQuery(`#${tag}`)}
            onLoadMore={() => vaultPath && loadMore(vaultPath)}
            onRecentSearchClick={setQuery}
            onRemoveRecentSearch={removeRecentSearch}
            onClearRecentSearches={clearRecentSearches}
          />
        </div>
      </div>
    </div>
  )
}
