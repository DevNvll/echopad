import React from 'react';
import { Command } from 'cmdk';
import { Notebook, Note } from '../../types';
import { TagWithCount } from '../../api';
import { CommandInput } from './CommandInput';
import { CommandFooter } from './CommandFooter';
import { useCommandSearch } from './hooks/useCommandSearch';
import {
  AppCommandsGroup,
  NotebooksGroup,
  TagsGroup,
  SearchResultsGroup,
} from './groups';

interface CommandPaletteProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  notebooks: Notebook[];
  vaultPath: string | null;
  onSelectNotebook: (relativePath: string) => void;
  onSelectMessage: (note: Note) => void;
  onCreateNotebook: () => void;
  onOpenSettings: (section?: 'general' | 'storage' | 'appearance' | 'about') => void;
  allTags?: TagWithCount[];
  initialSearch?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  setIsOpen,
  notebooks,
  vaultPath,
  onSelectNotebook,
  onSelectMessage,
  onCreateNotebook,
  onOpenSettings,
  allTags = [],
  initialSearch = '',
}) => {
  const { search, setSearch, results, filteredTags } = useCommandSearch({
    isOpen,
    vaultPath,
    allTags,
    initialSearch,
  });

  const handleClose = () => setIsOpen(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'j') {
      e.preventDefault();
      e.stopPropagation();
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
      );
    }
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      e.stopPropagation();
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })
      );
    }
  };

  return (
    <Command.Dialog
      open={isOpen}
      onOpenChange={setIsOpen}
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
          onCreateNotebook={onCreateNotebook}
          onOpenSettings={onOpenSettings}
          onClose={handleClose}
        />

        <NotebooksGroup
          notebooks={notebooks}
          onSelectNotebook={onSelectNotebook}
          onClose={handleClose}
        />

        <TagsGroup
          tags={filteredTags}
          onSelectTag={(tag) => setSearch(`#${tag}`)}
        />

        <SearchResultsGroup
          results={results}
          onSelectNote={onSelectMessage}
          onClose={handleClose}
        />
      </Command.List>

      <CommandFooter />
    </Command.Dialog>
  );
};

