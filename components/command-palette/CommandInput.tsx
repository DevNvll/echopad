import { Command } from 'cmdk';
import { Search } from 'lucide-react';

interface CommandInputProps {
  value: string;
  onValueChange: (value: string) => void;
}

export const CommandInput = ({ value, onValueChange }: CommandInputProps) => {
  return (
    <div className="flex items-center border-b border-border/50 px-4">
      <Search className="w-4 h-4 text-textMuted mr-3" />
      <Command.Input
        value={value}
        onValueChange={onValueChange}
        placeholder="Type a command or search notes..."
        autoComplete="off"
        className="flex-1 h-12 bg-transparent text-sm text-textMain placeholder:text-textMuted/50 outline-none font-medium font-sans"
      />
      <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-surfaceHighlight px-1.5 font-mono text-[10px] font-medium text-textMuted">
        <span className="text-xs">ESC</span>
      </kbd>
    </div>
  );
};

