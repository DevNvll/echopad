import { Command } from 'cmdk';
import { Hash } from 'lucide-react';
import { Notebook } from '../../../types';
import { CommandItem, CommandShortcut } from '../CommandItem';

interface NotebooksGroupProps {
  notebooks: Notebook[];
  onSelectNotebook: (relativePath: string) => void;
  onClose: () => void;
}

const GROUP_HEADING_CLASS = "text-[10px] font-bold text-textMuted uppercase tracking-wider mb-2 px-2";

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

export const NotebooksGroup = ({ notebooks, onSelectNotebook, onClose }: NotebooksGroupProps) => {
  const flatNotebooks = flattenNotebooks(notebooks);

  return (
    <Command.Group heading="Notebooks" className={GROUP_HEADING_CLASS}>
      {flatNotebooks.map((notebook) => (
        <CommandItem
          key={notebook.relativePath}
          value={`notebook-${notebook.relativePath}`}
          onSelect={() => {
            onSelectNotebook(notebook.relativePath);
            onClose();
          }}
        >
          <Hash className="mr-2 h-4 w-4 text-textMuted" />
          <span>{notebook.relativePath}</span>
          <CommandShortcut>Jump to</CommandShortcut>
        </CommandItem>
      ))}
    </Command.Group>
  );
};

