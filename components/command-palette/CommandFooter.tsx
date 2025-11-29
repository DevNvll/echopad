const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="bg-surface border border-border rounded px-1 min-w-[16px] text-center">
    {children}
  </kbd>
);

export const CommandFooter = () => {
  return (
    <div className="border-t border-border/40 p-2 bg-surfaceHighlight/20 flex items-center justify-between text-[10px] text-textMuted px-4">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> to navigate
        </span>
        <span className="flex items-center gap-1">
          <Kbd>ctrl</Kbd> + <Kbd>j</Kbd> / <Kbd>k</Kbd>
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd> to select
        </span>
      </div>
    </div>
  );
};

