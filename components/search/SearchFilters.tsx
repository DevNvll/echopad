import { useState } from 'react'
import {
  Calendar as CalendarIcon,
  Tag,
  FolderOpen,
  Link2,
  Image,
  ChevronDown,
  ChevronUp,
  X,
  RotateCcw
} from 'lucide-react'
import { clsx } from 'clsx'
import { TagWithCount } from '../../api'
import { Notebook } from '../../types'
import { SearchFilterState } from '../../stores/searchStore'
import { format, subWeeks, subMonths, startOfDay, endOfDay } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { DateRange } from 'react-day-picker'

interface SearchFiltersProps {
  filters: SearchFilterState
  onFiltersChange: (filters: SearchFilterState) => void
  tags: TagWithCount[]
  notebooks: Notebook[]
  onClearFilters: () => void
  activeCount: number
}

type DatePreset = 'today' | 'week' | 'month' | '3months' | 'custom'

export function SearchFilters({
  filters,
  onFiltersChange,
  tags,
  notebooks,
  onClearFilters,
  activeCount
}: SearchFiltersProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['date', 'notebooks'])
  )
  const [datePreset, setDatePreset] = useState<DatePreset | null>(null)
  const [showAllTags, setShowAllTags] = useState(false)
  const [showAllNotebooks, setShowAllNotebooks] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  const handleDatePreset = (preset: DatePreset) => {
    const now = new Date()
    let from: Date | null = null
    const to = endOfDay(now)

    switch (preset) {
      case 'today':
        from = startOfDay(now)
        break
      case 'week':
        from = startOfDay(subWeeks(now, 1))
        break
      case 'month':
        from = startOfDay(subMonths(now, 1))
        break
      case '3months':
        from = startOfDay(subMonths(now, 3))
        break
      case 'custom':
        from = null
        break
    }

    setDatePreset(preset)
    onFiltersChange({
      ...filters,
      dateRange: { from, to: preset === 'custom' ? null : to }
    })
  }

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setDatePreset('custom')
    onFiltersChange({
      ...filters,
      dateRange: {
        from: range?.from ? startOfDay(range.from) : null,
        to: range?.to ? endOfDay(range.to) : null
      }
    })
  }

  const toggleTag = (tag: string) => {
    const isSelected = filters.selectedTags.includes(tag)
    onFiltersChange({
      ...filters,
      selectedTags: isSelected
        ? filters.selectedTags.filter((t) => t !== tag)
        : [...filters.selectedTags, tag]
    })
  }

  const toggleNotebook = (relativePath: string) => {
    const isSelected = filters.selectedNotebooks.includes(relativePath)
    onFiltersChange({
      ...filters,
      selectedNotebooks: isSelected
        ? filters.selectedNotebooks.filter((n) => n !== relativePath)
        : [...filters.selectedNotebooks, relativePath]
    })
  }

  const toggleHasLink = () => {
    onFiltersChange({
      ...filters,
      hasLink: filters.hasLink === true ? null : true
    })
  }

  const toggleHasImage = () => {
    onFiltersChange({
      ...filters,
      hasImage: filters.hasImage === true ? null : true
    })
  }

  const clearDateFilter = () => {
    setDatePreset(null)
    onFiltersChange({
      ...filters,
      dateRange: { from: null, to: null }
    })
  }

  const displayedTags = showAllTags ? tags : tags.slice(0, 8)
  const displayedNotebooks = showAllNotebooks ? notebooks : notebooks.slice(0, 6)

  const dateRangeValue: DateRange | undefined =
    filters.dateRange.from || filters.dateRange.to
      ? {
          from: filters.dateRange.from ?? undefined,
          to: filters.dateRange.to ?? undefined
        }
      : undefined

  const formatDateRange = () => {
    if (!filters.dateRange.from && !filters.dateRange.to) {
      return 'Select dates'
    }
    if (filters.dateRange.from && filters.dateRange.to) {
      return `${format(filters.dateRange.from, 'MMM d')} - ${format(filters.dateRange.to, 'MMM d, yyyy')}`
    }
    if (filters.dateRange.from) {
      return `From ${format(filters.dateRange.from, 'MMM d, yyyy')}`
    }
    if (filters.dateRange.to) {
      return `Until ${format(filters.dateRange.to, 'MMM d, yyyy')}`
    }
    return 'Select dates'
  }

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between px-1 mb-3">
        <h3 className="text-[13px] font-semibold text-textMain tracking-tight">
          Filters
        </h3>
        {activeCount > 0 && (
          <button
            onClick={onClearFilters}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-textMuted hover:text-textMain hover:bg-surfaceHighlight/50 transition-colors"
          >
            <RotateCcw size={11} />
            Clear
          </button>
        )}
      </div>

      <FilterSection
        icon={<CalendarIcon size={14} />}
        title="Date range"
        isExpanded={expandedSections.has('date')}
        onToggle={() => toggleSection('date')}
        hasActiveFilter={!!filters.dateRange.from || !!filters.dateRange.to}
        onClear={clearDateFilter}
      >
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { key: 'today', label: 'Today' },
              { key: 'week', label: 'Week' },
              { key: 'month', label: 'Month' },
              { key: '3months', label: '3 months' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleDatePreset(key as DatePreset)}
                className={clsx(
                  'px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors text-center',
                  datePreset === key
                    ? 'bg-brand/20 text-brand border border-brand/30'
                    : 'bg-surfaceHighlight/50 text-textMuted hover:text-textMain hover:bg-surfaceHighlight border border-transparent'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={clsx(
                  'w-full justify-start text-left font-normal h-8 text-[11px] bg-surfaceHighlight/50 border-border/50 hover:bg-surfaceHighlight',
                  !dateRangeValue && 'text-textMuted'
                )}
              >
                <CalendarIcon className="mr-2 h-3 w-3" />
                <span className="truncate">{formatDateRange()}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                defaultMonth={filters.dateRange.from ?? undefined}
                selected={dateRangeValue}
                onSelect={handleDateRangeSelect}
                numberOfMonths={1}
              />
            </PopoverContent>
          </Popover>
        </div>
      </FilterSection>

      <FilterSection
        icon={<Tag size={14} />}
        title="Tags"
        isExpanded={expandedSections.has('tags')}
        onToggle={() => toggleSection('tags')}
        hasActiveFilter={filters.selectedTags.length > 0}
        onClear={() => onFiltersChange({ ...filters, selectedTags: [] })}
        badge={
          filters.selectedTags.length > 0 ? filters.selectedTags.length : undefined
        }
      >
        {tags.length > 0 ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {displayedTags.map(({ tag, count }) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={clsx(
                    'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors',
                    filters.selectedTags.includes(tag)
                      ? 'bg-brand/20 text-brand border border-brand/30'
                      : 'bg-surfaceHighlight/50 text-textMuted hover:text-textMain hover:bg-surfaceHighlight border border-transparent'
                  )}
                >
                  <span className="opacity-60">#</span>
                  <span className="truncate max-w-[80px]">{tag}</span>
                  <span className="opacity-50">({count})</span>
                </button>
              ))}
            </div>
            {tags.length > 8 && (
              <button
                onClick={() => setShowAllTags(!showAllTags)}
                className="text-[10px] text-brand/70 hover:text-brand transition-colors"
              >
                {showAllTags ? 'Show less' : `+${tags.length - 8} more`}
              </button>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-textMuted/50">No tags found</p>
        )}
      </FilterSection>

      <FilterSection
        icon={<FolderOpen size={14} />}
        title="Notebooks"
        isExpanded={expandedSections.has('notebooks')}
        onToggle={() => toggleSection('notebooks')}
        hasActiveFilter={filters.selectedNotebooks.length > 0}
        onClear={() => onFiltersChange({ ...filters, selectedNotebooks: [] })}
        badge={
          filters.selectedNotebooks.length > 0
            ? filters.selectedNotebooks.length
            : undefined
        }
      >
        {notebooks.length > 0 ? (
          <div className="space-y-1">
            <div className="space-y-0.5 max-h-[180px] overflow-y-auto">
              {displayedNotebooks.map((notebook) => (
                <button
                  key={notebook.relativePath}
                  onClick={() => toggleNotebook(notebook.relativePath)}
                  className={clsx(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-left transition-colors',
                    filters.selectedNotebooks.includes(notebook.relativePath)
                      ? 'bg-brand/20 text-brand'
                      : 'text-textMuted hover:text-textMain hover:bg-surfaceHighlight/50'
                  )}
                >
                  <FolderOpen size={11} className="opacity-50 shrink-0" />
                  <span className="truncate">{notebook.name}</span>
                </button>
              ))}
            </div>
            {notebooks.length > 6 && (
              <button
                onClick={() => setShowAllNotebooks(!showAllNotebooks)}
                className="text-[10px] text-brand/70 hover:text-brand transition-colors pl-2"
              >
                {showAllNotebooks ? 'Show less' : `+${notebooks.length - 6} more`}
              </button>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-textMuted/50">No notebooks found</p>
        )}
      </FilterSection>

      <FilterSection
        icon={<Link2 size={14} />}
        title="Content"
        isExpanded={expandedSections.has('content')}
        onToggle={() => toggleSection('content')}
        hasActiveFilter={filters.hasLink !== null || filters.hasImage !== null}
        onClear={() => onFiltersChange({ ...filters, hasLink: null, hasImage: null })}
      >
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={toggleHasLink}
            className={clsx(
              'flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] transition-colors',
              filters.hasLink === true
                ? 'bg-brand/20 text-brand border border-brand/30'
                : 'bg-surfaceHighlight/50 text-textMuted hover:text-textMain hover:bg-surfaceHighlight border border-transparent'
            )}
          >
            <Link2 size={11} />
            Links
          </button>
          <button
            onClick={toggleHasImage}
            className={clsx(
              'flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] transition-colors',
              filters.hasImage === true
                ? 'bg-brand/20 text-brand border border-brand/30'
                : 'bg-surfaceHighlight/50 text-textMuted hover:text-textMain hover:bg-surfaceHighlight border border-transparent'
            )}
          >
            <Image size={11} />
            Images
          </button>
        </div>
      </FilterSection>
    </div>
  )
}

interface FilterSectionProps {
  icon: React.ReactNode
  title: string
  isExpanded: boolean
  onToggle: () => void
  hasActiveFilter?: boolean
  onClear?: () => void
  badge?: number
  children: React.ReactNode
}

function FilterSection({
  icon,
  title,
  isExpanded,
  onToggle,
  hasActiveFilter,
  onClear,
  badge,
  children
}: FilterSectionProps) {
  return (
    <div className="border border-border/30 rounded-lg overflow-hidden bg-surface/30">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-2.5 py-2 hover:bg-surfaceHighlight/30 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={clsx(
              'shrink-0 transition-colors',
              hasActiveFilter ? 'text-brand' : 'text-textMuted/50'
            )}
          >
            {icon}
          </span>
          <span
            className={clsx(
              'text-[11px] font-medium truncate',
              hasActiveFilter ? 'text-textMain' : 'text-textMuted'
            )}
          >
            {title}
          </span>
          {badge !== undefined && (
            <span className="px-1.5 py-0.5 rounded-full bg-brand/20 text-brand text-[9px] font-medium shrink-0">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {hasActiveFilter && onClear && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClear()
              }}
              className="p-1 rounded text-textMuted/50 hover:text-textMain hover:bg-surfaceHighlight transition-colors"
            >
              <X size={11} />
            </button>
          )}
          {isExpanded ? (
            <ChevronUp size={13} className="text-textMuted/50" />
          ) : (
            <ChevronDown size={13} className="text-textMuted/50" />
          )}
        </div>
      </button>
      {isExpanded && <div className="px-2.5 pt-1 pb-2.5">{children}</div>}
    </div>
  )
}
