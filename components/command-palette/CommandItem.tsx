import { Command } from 'cmdk';
import { clsx } from 'clsx';

interface CommandItemProps {
  children?: React.ReactNode;
  onSelect?: (value: string) => void;
  value?: string;
  className?: string;
}

export const CommandItem = ({ children, onSelect, value, className }: CommandItemProps) => {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className={clsx(
        "relative flex cursor-default select-none items-center rounded-md px-3 py-2 text-sm outline-none",
        "data-[disabled=true]:pointer-events-none data-[selected=true]:bg-brand/20 data-[selected=true]:text-textMain",
        "data-[disabled=true]:opacity-50 transition-colors group",
        className
      )}
    >
      {children}
    </Command.Item>
  );
};

export const CommandShortcut = ({ children }: { children?: React.ReactNode }) => {
  return (
    <span className="ml-auto text-xs tracking-widest text-textMuted/50 group-data-[selected=true]:text-textMain/70">
      {children}
    </span>
  );
};

