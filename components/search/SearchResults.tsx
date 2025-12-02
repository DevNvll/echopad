import { useRef, useCallback, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Loader2, SearchX, Search, Clock, X, Trash2 } from 'lucide-react'
import { Note } from '../../types'
import { RecentSearch } from '../../stores/searchStore'
import { SearchResultItem } from './SearchResultItem'
import { formatDistanceToNow } from 'date-fns'

interface SearchResultsProps {
  results: Note[]
  isSearching: boolean
  isLoadingMore: boolean
  hasSearched: boolean
  hasMore: boolean
  query: string
  recentSearches: RecentSearch[]
  onResultClick: (note: Note) => void
  onTagClick: (tag: string) => void
  onLoadMore: () => void
  onRecentSearchClick: (query: string) => void
  onRemoveRecentSearch: (query: string) => void
  onClearRecentSearches: () => void
}

const ESTIMATED_ITEM_SIZE = 100

export function SearchResults({
  results,
  isSearching,
  isLoadingMore,
  hasSearched,
  hasMore,
  query,
  recentSearches,
  onResultClick,
  onTagClick,
  onLoadMore,
  onRecentSearchClick,
  onRemoveRecentSearch,
  onClearRecentSearches
}: SearchResultsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const loadMoreTriggeredRef = useRef(false)

  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ESTIMATED_ITEM_SIZE,
    overscan: 5,
    gap: 8
  })

  const virtualItems = virtualizer.getVirtualItems()

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || isLoadingMore || !hasMore) return

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight

    if (distanceFromBottom < 300 && !loadMoreTriggeredRef.current) {
      loadMoreTriggeredRef.current = true
      onLoadMore()
    }
  }, [isLoadingMore, hasMore, onLoadMore])

  useEffect(() => {
    if (!isLoadingMore) {
      loadMoreTriggeredRef.current = false
    }
  }, [isLoadingMore])

  useEffect(() => {
    loadMoreTriggeredRef.current = false
  }, [query])

  if (isSearching) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <Loader2 size={24} className="text-brand animate-spin mb-3" />
        <p className="text-[13px] text-textMuted">Searching...</p>
      </div>
    )
  }

  if (!hasSearched) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 px-6">
        <div className="w-14 h-14 rounded-2xl bg-surfaceHighlight/50 flex items-center justify-center mb-4">
          <Search size={24} className="text-textMuted/30" />
        </div>
        <h3 className="text-[14px] font-medium text-textMain mb-1">
          Search your notes
        </h3>
        <p className="text-[12px] text-textMuted/60 text-center max-w-xs mb-6">
          Enter a search term or apply filters to find notes
        </p>

        {recentSearches.length > 0 && (
          <div className="w-full max-w-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-textMuted/60">
                <Clock size={12} />
                <span className="text-[11px] font-medium">Recent searches</span>
              </div>
              <button
                onClick={onClearRecentSearches}
                className="flex items-center gap-1 text-[10px] text-textMuted/50 hover:text-textMain transition-colors"
              >
                <Trash2 size={10} />
                Clear all
              </button>
            </div>
            <div className="space-y-1">
              {recentSearches.map((search) => (
                <div
                  key={search.query}
                  className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-surface/50 border border-border/30 hover:border-brand/30 hover:bg-surface/80 transition-all cursor-pointer"
                  onClick={() => onRecentSearchClick(search.query)}
                >
                  <Search size={12} className="text-textMuted/40 shrink-0" />
                  <span className="flex-1 text-[12px] text-textMain/80 truncate">
                    {search.query}
                  </span>
                  <span className="text-[9px] text-textMuted/40 shrink-0">
                    {formatDistanceToNow(search.timestamp, { addSuffix: true })}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveRecentSearch(search.query)
                    }}
                    className="p-0.5 rounded text-textMuted/30 hover:text-textMain hover:bg-surfaceHighlight opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentSearches.length === 0 && (
          <div className="flex flex-wrap justify-center gap-2 max-w-sm">
            <SearchTip>Use #tag to search by tag</SearchTip>
            <SearchTip>Combine filters for precise results</SearchTip>
          </div>
        )}
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 px-6">
        <div className="w-14 h-14 rounded-2xl bg-surfaceHighlight/50 flex items-center justify-center mb-4">
          <SearchX size={24} className="text-textMuted/30" />
        </div>
        <h3 className="text-[14px] font-medium text-textMain mb-1">
          No results found
        </h3>
        <p className="text-[12px] text-textMuted/60 text-center max-w-xs">
          {query
            ? `No notes match "${query}"`
            : 'No notes match your current filters'}
        </p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-4 py-3 border-b border-border/20">
        <p className="text-[11px] text-textMuted">
          <span className="font-semibold text-textMain">{results.length}</span>
          {hasMore && '+'}{' '}
          {results.length === 1 ? 'result' : 'results'}
          {query && (
            <span>
              {' '}
              for "<span className="text-brand">{query}</span>"
            </span>
          )}
        </p>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-3"
        onScroll={handleScroll}
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative'
          }}
        >
          {virtualItems.map((virtualItem) => {
            const note = results[virtualItem.index]
            if (!note) return null

            return (
              <div
                key={`${note.notebookName}-${note.filename}`}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`
                }}
              >
                <SearchResultItem
                  note={note}
                  query={query}
                  onClick={() => onResultClick(note)}
                  onTagClick={onTagClick}
                />
              </div>
            )
          })}
        </div>

        {isLoadingMore && (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={18} className="text-brand animate-spin mr-2" />
            <span className="text-[12px] text-textMuted">Loading more...</span>
          </div>
        )}
      </div>
    </div>
  )
}

function SearchTip({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-1 rounded-full bg-surfaceHighlight/50 border border-border/30 text-[10px] text-textMuted/70">
      {children}
    </span>
  )
}
