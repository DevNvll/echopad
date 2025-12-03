import { Command } from 'cmdk'
import { Clock, Search, X } from 'lucide-react'
import { CommandItem } from '../CommandItem'
import { RecentSearch } from '../../../stores/searchStore'
import { formatDistanceToNow } from 'date-fns'

interface RecentSearchesGroupProps {
  searches: RecentSearch[]
  onSelectSearch: (query: string) => void
  onRemoveSearch: (query: string) => void
}

const GROUP_HEADING_CLASS =
  'text-[10px] font-bold text-textMuted uppercase tracking-wider mb-2 px-2'

export const RecentSearchesGroup = ({
  searches,
  onSelectSearch,
  onRemoveSearch
}: RecentSearchesGroupProps) => {
  if (searches.length === 0) return null

  return (
    <Command.Group heading="Recent Searches" className={GROUP_HEADING_CLASS}>
      {searches.slice(0, 5).map((search) => (
        <CommandItem
          key={search.query}
          value={`recent-search-${search.query}`}
          onSelect={() => onSelectSearch(search.query)}
          className="group/item"
        >
          <Clock className="mr-2 h-4 w-4 text-textMuted/50" />
          <Search className="mr-2 h-3 w-3 text-textMuted/30" />
          <span className="flex-1 truncate">{search.query}</span>
          <span className="text-[10px] text-textMuted/40 mr-2">
            {formatDistanceToNow(search.timestamp, { addSuffix: true })}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemoveSearch(search.query)
            }}
            className="p-1 rounded text-textMuted/30 hover:text-textMain hover:bg-surfaceHighlight opacity-0 group-hover/item:opacity-100 transition-all"
          >
            <X size={12} />
          </button>
        </CommandItem>
      ))}
    </Command.Group>
  )
}


