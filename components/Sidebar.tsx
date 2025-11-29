import React, { useState, useRef, useEffect } from 'react';
import { Notebook } from '../types';
import { Hash, Plus, Pin, PinOff, ChevronDown, FolderOpen, Check } from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  notebooks: Notebook[];
  activeNotebook: string | null;
  onSelectNotebook: (name: string) => void;
  onCreateNotebook: () => void;
  onContextMenu: (e: React.MouseEvent, notebook: Notebook) => void;
  onTogglePin: (notebook: Notebook) => void;
  width: number;
  vaultPath: string | null;
  onChangeVault: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  notebooks, 
  activeNotebook, 
  onSelectNotebook,
  onCreateNotebook,
  onContextMenu,
  onTogglePin,
  width,
  vaultPath,
  onChangeVault
}) => {
  const [isVaultDropdownOpen, setIsVaultDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const pinnedNotebooks = notebooks.filter(n => n.isPinned);
  const regularNotebooks = notebooks.filter(n => !n.isPinned);

  const vaultName = vaultPath?.split(/[/\\]/).pop() || 'Unknown Vault';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsVaultDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const renderNotebookItem = (notebook: Notebook) => (
    <button
      key={notebook.name}
      onClick={() => onSelectNotebook(notebook.name)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e, notebook);
      }}
      className={clsx(
        "w-full flex items-center gap-3 px-3 py-3 rounded-lg mx-0 transition-all text-[15px] group relative font-medium",
        activeNotebook === notebook.name 
          ? "bg-surfaceHighlight text-textMain shadow-sm" 
          : "text-textMuted hover:bg-surfaceHighlight/40 hover:text-textMain/90"
      )}
    >
      <Hash size={20} className={clsx(
        "shrink-0",
        activeNotebook === notebook.name ? "text-brand" : "text-textMuted/60 group-hover:text-textMuted"
      )} />
      <span className="truncate leading-none pb-[1px] flex-1 text-left">{notebook.name}</span>
      
      <div 
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin(notebook);
        }}
        className={clsx(
          "opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-surfaceHighlight rounded text-textMuted hover:text-textMain",
          notebook.isPinned && "opacity-100 text-brand hover:text-brand"
        )}
        title={notebook.isPinned ? "Unpin Notebook" : "Pin Notebook"}
      >
        {notebook.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
      </div>
    </button>
  );

  return (
    <div 
      style={{ width: `${width}px` }}
      className="bg-sidebar flex flex-col h-full border-r border-border/40 shrink-0 relative"
    >
      <div className="h-16 flex items-center px-6 font-bold text-textMain tracking-tight shadow-sm border-b border-border/20">
        <div className="w-3 h-3 rounded-full bg-brand mr-3 shadow-[0_0_10px_rgba(129,140,248,0.4)]"></div>
        <span className="text-[16px]">Lazuli</span>
      </div>

      <div className="p-3 border-b border-border/30" ref={dropdownRef}>
        <button
          onClick={() => setIsVaultDropdownOpen(!isVaultDropdownOpen)}
          className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-surfaceHighlight/40 hover:bg-surfaceHighlight/60 transition-colors group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand/20 to-brand/5 border border-brand/20 flex items-center justify-center shrink-0">
            <FolderOpen size={16} className="text-brand" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[13px] font-semibold text-textMain truncate leading-tight">{vaultName}</div>
            <div className="text-[11px] text-textMuted truncate">Current vault</div>
          </div>
          <ChevronDown 
            size={16} 
            className={clsx(
              "text-textMuted transition-transform shrink-0",
              isVaultDropdownOpen && "rotate-180"
            )} 
          />
        </button>
        
        {isVaultDropdownOpen && (
          <div className="absolute left-3 right-3 mt-2 bg-surface border border-border rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="p-1.5">
              <button
                onClick={() => {
                  setIsVaultDropdownOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left hover:bg-surfaceHighlight/50 transition-colors group"
              >
                <FolderOpen size={16} className="text-brand shrink-0" />
                <span className="text-[13px] text-textMain truncate flex-1">{vaultName}</span>
                <Check size={14} className="text-brand shrink-0" />
              </button>
            </div>
            <div className="border-t border-border/50">
              <button
                onClick={() => {
                  setIsVaultDropdownOpen(false);
                  onChangeVault();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surfaceHighlight/30 transition-colors"
              >
                <Plus size={16} className="text-textMuted shrink-0" />
                <span className="text-[13px] text-textMuted">Switch or create vault...</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar flex flex-col gap-2">
        
        {pinnedNotebooks.length > 0 && (
          <div className="mb-4">
            <div className="px-2 pb-2 flex items-center justify-between group mb-1">
              <h3 className="text-[11px] font-bold text-textMuted/60 uppercase tracking-widest group-hover:text-textMuted transition-colors">
                Pinned
              </h3>
            </div>
            {pinnedNotebooks.map(renderNotebookItem)}
            <div className="my-4 border-b border-border/30 mx-2" />
          </div>
        )}

        <div>
          <div className="px-2 pb-2 flex items-center justify-between group mb-2">
            <h3 className="text-[11px] font-bold text-textMuted/60 uppercase tracking-widest group-hover:text-textMuted transition-colors">
              Notebooks
            </h3>
            <button 
              onClick={onCreateNotebook}
              className="text-textMuted hover:text-textMain opacity-0 group-hover:opacity-100 transition-all p-1 rounded hover:bg-surfaceHighlight"
              title="Create Notebook"
            >
              <Plus size={14} strokeWidth={3} />
            </button>
          </div>

          {regularNotebooks.map(renderNotebookItem)}
        </div>
      </div>
    </div>
  );
};
