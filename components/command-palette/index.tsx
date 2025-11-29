import React from 'react'
import { Command } from 'cmdk'
import { Note } from '../../types'
import { CommandInput } from './CommandInput'
import { CommandFooter } from './CommandFooter'
import { useCommandSearch } from './hooks/useCommandSearch'
import {
  AppCommandsGroup,
  NotebooksGroup,
  TagsGroup,
  SearchResultsGroup
} from './groups'
import {
  useVaultStore,
  useNotebookStore,
  useNotesStore,
  useTagsStore,
  useUIStore
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
    openSettings
  } = useUIStore()

  const { search, setSearch, results, filteredTags } = useCommandSearch({
    isOpen: isCommandOpen,
    vaultPath,
    allTags,
    initialSearch: commandInitialSearch
  })

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

        <AppCommandsGroup
          onCreateNotebook={handleCreateNotebook}
          onOpenSettings={handleOpenSettings}
          onClose={handleClose}
        />

        <NotebooksGroup
          notebooks={notebooks}
          onSelectNotebook={handleSelectNotebook}
          onClose={handleClose}
        />

        <TagsGroup
          tags={filteredTags}
          onSelectTag={(tag) => setSearch(`#${tag}`)}
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
