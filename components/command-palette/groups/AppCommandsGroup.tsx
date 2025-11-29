import { Command } from 'cmdk';
import { Plus, Settings, HardDrive, Palette, Info } from 'lucide-react';
import { CommandItem, CommandShortcut } from '../CommandItem';

type SettingsSection = 'general' | 'storage' | 'appearance' | 'about';

interface AppCommandsGroupProps {
  onCreateNotebook: () => void;
  onOpenSettings: (section?: SettingsSection) => void;
  onClose: () => void;
}

const GROUP_HEADING_CLASS = "text-[10px] font-bold text-textMuted uppercase tracking-wider mb-2 px-2";

export const AppCommandsGroup = ({ onCreateNotebook, onOpenSettings, onClose }: AppCommandsGroupProps) => {
  const handleSelect = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <Command.Group heading="App Commands" className={GROUP_HEADING_CLASS}>
      <CommandItem onSelect={() => handleSelect(onCreateNotebook)}>
        <Plus className="mr-2 h-4 w-4 text-brand" />
        <span>Create New Notebook</span>
        <CommandShortcut>⌘N</CommandShortcut>
      </CommandItem>

      <CommandItem onSelect={() => handleSelect(() => onOpenSettings())}>
        <Settings className="mr-2 h-4 w-4 text-textMuted" />
        <span>Settings: General</span>
        <CommandShortcut>⌘,</CommandShortcut>
      </CommandItem>

      <CommandItem onSelect={() => handleSelect(() => onOpenSettings('storage'))}>
        <HardDrive className="mr-2 h-4 w-4 text-textMuted" />
        <span>Settings: Storage & Vaults</span>
      </CommandItem>

      <CommandItem onSelect={() => handleSelect(() => onOpenSettings('appearance'))}>
        <Palette className="mr-2 h-4 w-4 text-textMuted" />
        <span>Settings: Appearance</span>
      </CommandItem>

      <CommandItem onSelect={() => handleSelect(() => onOpenSettings('about'))}>
        <Info className="mr-2 h-4 w-4 text-textMuted" />
        <span>Settings: About</span>
      </CommandItem>
    </Command.Group>
  );
};

