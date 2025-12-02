import React from 'react'
import { Command } from 'cmdk'
import { Search, ArrowRight } from 'lucide-react'
import { Note } from '../../types'
import { CommandInput } from './CommandInput'
import { CommandFooter } from './CommandFooter'
import { CommandItem } from './CommandItem'
import { useCommandSearch } from './hooks/useCommandSearch'
import {
  AppCommandsGroup,
  NotebooksGroup,
  TagsGroup,
  SearchResultsGroup,
  RecentSearchesGroup
} from './groups'
import {
  useVaultStore,
  useNotebookStore,
  useNotesStore,
  useTagsStore,
  useUIStore,
  useSearchStore
} from '../../stores'

export const CommandPalette: React.FC = () => {
  const { vaultPath } = useVaultStore()
  const { notebooks, selectNotebook } = useNotebookStore()
  const { setTarget } = useNotesStore()
  const { allTags } = useTagsStore()
  const {
    isCommandOpen,
    commandInitialSearch,
    closeCommand,
    openCreateModal,
    openSettings,
    openSearch
  } = useUIStore()

  const { search, setSearch, results, filteredTags } = useCommandSearch({
    isOpen: isCommandOpen,
    vaultPath,
    allTags,
    initialSearch: commandInitialSearch
  })

  const {
    recentSearches,
    loadRecentSearches,
    removeRecentSearch
  } = useSearchStore()

  React.useEffect(() => {
    if (isCommandOpen) {
      loadRecentSearches()
    }
  }, [isCommandOpen, loadRecentSearches])

  const handleClose = () => closeCommand()

  const handleSelectNotebook = (relativePath: string) => {
    selectNotebook(relativePath)
    handleClose()
  }

  const handleSelectMessage = (note: Note) => {
    if (note.notebookName) {
      setTarget(note.filename)
      selectNotebook(note.notebookName)
    }
    handleClose()
  }

  const handleCreateNotebook = () => {
    openCreateModal()
    handleClose()
  }

  const handleOpenSettings = (
    section?: 'general' | 'storage' | 'appearance' | 'about'
  ) => {
    openSettings(section)
    handleClose()
  }

  const handleOpenSearch = (query?: string) => {
    openSearch(query)
    handleClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'j') {
      e.preventDefault()
      e.stopPropagation()
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
      )
    }
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault()
      e.stopPropagation()
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })
      )
    }
  }

  const hasSearchQuery = search.trim().length > 0

  return (
    <Command.Dialog
      open={isCommandOpen}
      onOpenChange={(open) => (open ? null : closeCommand())}
      loop
      label="Global Command Menu"
      onKeyDown={handleKeyDown}
      className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-surface border border-border shadow-2xl rounded-xl overflow-hidden animate-content-show"
      overlayClassName="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40 animate-overlay-show"
    >
      <CommandInput value={search} onValueChange={setSearch} />

      <Command.List className="max-h-[60vh] overflow-y-auto overflow-x-hidden p-2 custom-scrollbar scroll-py-2">
        <Command.Empty className="py-6 text-center text-sm text-textMuted">
          No results found.
        </Command.Empty>

        {hasSearchQuery && (
          <Command.Group>
            <CommandItem
              onSelect={() => handleOpenSearch(search)}
              className="bg-brand/10 border border-brand/20 mb-2"
            >
              <Search className="mr-2 h-4 w-4 text-brand" />
              <span className="flex-1">
                Search all notes for "<span className="font-medium text-brand">{search}</span>"
              </span>
              <ArrowRight className="h-4 w-4 text-brand/60" />
            </CommandItem>
          </Command.Group>
        )}

        <AppCommandsGroup
          onCreateNotebook={handleCreateNotebook}
          onOpenSettings={handleOpenSettings}
          onOpenSearch={() => handleOpenSearch()}
          onClose={handleClose}
        />

        {!hasSearchQuery && recentSearches.length > 0 && (
          <RecentSearchesGroup
            searches={recentSearches}
            onSelectSearch={handleOpenSearch}
            onRemoveSearch={removeRecentSearch}
          />
        )}

        <NotebooksGroup
          notebooks={notebooks}
          onSelectNotebook={handleSelectNotebook}
          onClose={handleClose}
        />

        <TagsGroup
          tags={filteredTags}
          onSelectTag={(tag) => handleOpenSearch(`#${tag}`)}
        />

        <SearchResultsGroup
          results={results}
          onSelectNote={handleSelectMessage}
          onClose={handleClose}
        />
      </Command.List>

      <CommandFooter />
    </Command.Dialog>
  )
}
