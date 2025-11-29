import { Command } from 'cmdk';
import { Tag } from 'lucide-react';
import { TagWithCount } from '../../../api';
import { CommandItem, CommandShortcut } from '../CommandItem';

interface TagsGroupProps {
  tags: TagWithCount[];
  onSelectTag: (tag: string) => void;
}

const GROUP_HEADING_CLASS = "text-[10px] font-bold text-textMuted uppercase tracking-wider mb-2 px-2";

export const TagsGroup = ({ tags, onSelectTag }: TagsGroupProps) => {
  if (tags.length === 0) return null;

  return (
    <Command.Group heading="Tags" className={GROUP_HEADING_CLASS}>
      {tags.map((tagItem) => (
        <CommandItem
          key={tagItem.tag}
          value={`tag-${tagItem.tag}`}
          onSelect={() => onSelectTag(tagItem.tag)}
        >
          <Tag className="mr-2 h-4 w-4 text-brand" />
          <span>#{tagItem.tag}</span>
          <CommandShortcut>{tagItem.count} notes</CommandShortcut>
        </CommandItem>
      ))}
    </Command.Group>
  );
};

