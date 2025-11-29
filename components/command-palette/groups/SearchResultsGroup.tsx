import { Command } from 'cmdk';
import { FileText, Hash, Calendar, CornerDownLeft } from 'lucide-react';
import { Note } from '../../../types';
import { formatMessageDate } from '../../../utils/formatting';
import { CommandItem, CommandShortcut } from '../CommandItem';

interface SearchResultsGroupProps {
  results: Note[];
  onSelectNote: (note: Note) => void;
  onClose: () => void;
}

const GROUP_HEADING_CLASS = "text-[10px] font-bold text-textMuted uppercase tracking-wider mb-2 px-2";

export const SearchResultsGroup = ({ results, onSelectNote, onClose }: SearchResultsGroupProps) => {
  if (results.length === 0) return null;

  return (
    <Command.Group heading="Search Results" className={GROUP_HEADING_CLASS}>
      {results.map((note) => (
        <CommandItem
          key={note.filename}
          value={`${note.content}-${note.filename}`}
          onSelect={() => {
            onSelectNote(note);
            onClose();
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
          <CommandShortcut>
            <CornerDownLeft size={14} />
          </CommandShortcut>
        </CommandItem>
      ))}
    </Command.Group>
  );
};

