import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { Hash, Plus, Search, FileText, CornerDownLeft, Calendar, Tag, Settings } from 'lucide-react';
import { Notebook, Note } from '../types';
import { searchNotes, searchByTag, TagWithCount } from '../api';
import { formatMessageDate } from '../utils/formatting';
import { clsx } from 'clsx';

interface CommandPaletteProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  notebooks: Notebook[];
  vaultPath: string | null;
  onSelectNotebook: (relativePath: string) => void;
  onSelectMessage: (note: Note) => void;
  onCreateNotebook: () => void;
  onOpenSettings: () => void;
  allTags?: TagWithCount[];
  initialSearch?: string;
}

const flattenNotebooks = (notebooks: Notebook[]): Notebook[] => {
  const result: Notebook[] = [];
  for (const nb of notebooks) {
    result.push(nb);
    if (nb.children) {
      result.push(...flattenNotebooks(nb.children));
    }
  }
  return result;
};

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
  const [search, setSearch] = useState(initialSearch);
  const [results, setResults] = useState<Note[]>([]);

  useEffect(() => {
    if (isOpen && initialSearch) {
      setSearch(initialSearch);
    }
  }, [isOpen, initialSearch]);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setResults([]);
    }
  }, [isOpen]);

  const isTagSearch = search.trim().startsWith('#');
  const tagQuery = isTagSearch ? search.trim().slice(1).toLowerCase() : '';

  const filteredTags = isTagSearch && tagQuery
    ? allTags.filter(t => t.tag.toLowerCase().includes(tagQuery))
    : allTags.slice(0, 10);

  useEffect(() => {
    const runSearch = async () => {
      if (!search.trim() || !vaultPath) {
        setResults([]);
        return;
      }
      
      if (isTagSearch && tagQuery) {
        const exactMatch = allTags.find(t => t.tag.toLowerCase() === tagQuery);
        if (exactMatch) {
          const found = await searchByTag(vaultPath, tagQuery);
          setResults(found.slice(0, 20));
          return;
        }
      }
      
      const found = await searchNotes(vaultPath, search);
      setResults(found.slice(0, 20));
    };

    const timer = setTimeout(runSearch, 150);
    return () => clearTimeout(timer);
  }, [search, vaultPath, isTagSearch, tagQuery, allTags]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'j') {
      e.preventDefault();
      e.stopPropagation();
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      document.activeElement?.dispatchEvent(event);
    }
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      e.stopPropagation();
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true });
      document.activeElement?.dispatchEvent(event);
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
      <div className="flex items-center border-b border-border/50 px-4">
        <Search className="w-4 h-4 text-textMuted mr-3" />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Type a command or search notes..."
          className="flex-1 h-12 bg-transparent text-sm text-textMain placeholder:text-textMuted/50 outline-none font-medium font-sans"
        />
        <div className="flex gap-1">
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-surfaceHighlight px-1.5 font-mono text-[10px] font-medium text-textMuted opacity-100">
            <span className="text-xs">ESC</span>
          </kbd>
        </div>
      </div>

      <Command.List className="max-h-[60vh] overflow-y-auto overflow-x-hidden p-2 custom-scrollbar scroll-py-2">
        <Command.Empty className="py-6 text-center text-sm text-textMuted">
          No results found.
        </Command.Empty>

        <Command.Group heading="App Commands" className="text-[10px] font-bold text-textMuted uppercase tracking-wider mb-2 px-2">
          <CommandItem 
            onSelect={() => {
              onCreateNotebook();
              setIsOpen(false);
            }}
          >
            <Plus className="mr-2 h-4 w-4 text-brand" />
            <span>Create New Notebook</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem 
            onSelect={() => {
              onOpenSettings();
              setIsOpen(false);
            }}
          >
            <Settings className="mr-2 h-4 w-4 text-textMuted" />
            <span>Open Settings</span>
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>
        </Command.Group>

        <Command.Group heading="Notebooks" className="text-[10px] font-bold text-textMuted uppercase tracking-wider mb-2 px-2">
          {flattenNotebooks(notebooks).map((notebook) => (
            <CommandItem
              key={notebook.relativePath}
              value={`notebook-${notebook.relativePath}`}
              onSelect={() => {
                onSelectNotebook(notebook.relativePath);
                setIsOpen(false);
              }}
            >
              <Hash className="mr-2 h-4 w-4 text-textMuted" />
              <span>{notebook.relativePath}</span>
              <CommandShortcut>Jump to</CommandShortcut>
            </CommandItem>
          ))}
        </Command.Group>

        {filteredTags.length > 0 && (
          <Command.Group heading="Tags" className="text-[10px] font-bold text-textMuted uppercase tracking-wider mb-2 px-2">
            {filteredTags.map((tagItem) => (
              <CommandItem
                key={tagItem.tag}
                value={`tag-${tagItem.tag}`}
                onSelect={() => {
                  setSearch(`#${tagItem.tag}`);
                }}
              >
                <Tag className="mr-2 h-4 w-4 text-brand" />
                <span>#{tagItem.tag}</span>
                <CommandShortcut>{tagItem.count} notes</CommandShortcut>
              </CommandItem>
            ))}
          </Command.Group>
        )}

        {results.length > 0 && (
          <Command.Group heading="Search Results" className="text-[10px] font-bold text-textMuted uppercase tracking-wider mb-2 px-2">
            {results.map((note) => {
              return (
                <CommandItem
                  key={note.filename}
                  value={`${note.content}-${note.filename}`}
                  onSelect={() => {
                    onSelectMessage(note);
                    setIsOpen(false);
                  }}
                  className="items-start py-3"
                >
                  <FileText className="mr-2 h-4 w-4 text-textMuted shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] bg-surfaceHighlight border border-border/50 px-1.5 rounded text-textMuted flex items-center gap-0.5">
                        <Hash size={8} /> {note.notebookName}
                      </span>
                      <span className="text-[10px] text-textMuted/60 flex items-center gap-1">
                        <Calendar size={8} />
                        {formatMessageDate(note.createdAt)}
                      </span>
                    </div>
                    <div className="text-sm text-textMain line-clamp-2 leading-relaxed opacity-90 break-words">
                      {note.content}
                    </div>
                  </div>
                  <CommandShortcut><CornerDownLeft size={14} /></CommandShortcut>
                </CommandItem>
              );
            })}
          </Command.Group>
        )}
      </Command.List>
      
      <div className="border-t border-border/40 p-2 bg-surfaceHighlight/20 flex items-center justify-between text-[10px] text-textMuted px-4">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><kbd className="bg-surface border border-border rounded px-1 min-w-[16px] text-center">↑</kbd> <kbd className="bg-surface border border-border rounded px-1 min-w-[16px] text-center">↓</kbd> to navigate</span>
          <span className="flex items-center gap-1"><kbd className="bg-surface border border-border rounded px-1">ctrl</kbd> + <kbd className="bg-surface border border-border rounded px-1">j</kbd> / <kbd className="bg-surface border border-border rounded px-1">k</kbd></span>
          <span className="flex items-center gap-1"><kbd className="bg-surface border border-border rounded px-1">↵</kbd> to select</span>
        </div>
      </div>
    </Command.Dialog>
  );
};

const CommandItem = ({ children, onSelect, value, className, ...props }: { children?: React.ReactNode; onSelect?: (value: string) => void; value?: string; className?: string; [key: string]: unknown }) => {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className={clsx(
        "relative flex cursor-default select-none items-center rounded-md px-3 py-2 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-brand/20 data-[selected=true]:text-textMain data-[disabled=true]:opacity-50 transition-colors group",
        className
      )}
      {...props}
    >
      {children}
    </Command.Item>
  );
};

const CommandShortcut = ({ children }: { children?: React.ReactNode }) => {
  return (
    <span className="ml-auto text-xs tracking-widest text-textMuted/50 group-data-[selected=true]:text-textMain/70">
      {children}
    </span>
  );
};
