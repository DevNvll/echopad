import React, { useEffect, useRef } from 'react';
import { Trash2, Edit2, Copy } from 'lucide-react';

export type ContextMenuAction = 'edit' | 'delete' | 'copy';

interface ContextMenuItem {
  label: string;
  action: ContextMenuAction;
  icon?: React.ReactNode;
  destructive?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onSelect: (action: ContextMenuAction) => void;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onSelect, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    // Slight delay to prevent immediate closing if triggered by click
    setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
        document.addEventListener('contextmenu', handleClickOutside);
    }, 50);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
    };
  }, [onClose]);

  // Adjust position if it goes off screen
  const style: React.CSSProperties = {
    top: y,
    left: x,
  };

  if (menuRef.current) {
     const rect = menuRef.current.getBoundingClientRect();
     if (x + rect.width > window.innerWidth) {
        style.left = x - rect.width;
     }
     if (y + rect.height > window.innerHeight) {
        style.top = y - rect.height;
     }
  }

  return (
    <div 
      ref={menuRef}
      style={style}
      className="fixed z-[100] min-w-[180px] bg-[#111113] border border-border/60 rounded-lg shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] py-1.5 animate-in fade-in zoom-in-95 duration-100 flex flex-col"
    >
      {items.map((item, index) => (
        <button
          key={index}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(item.action);
          }}
          className={`
            w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2.5 transition-colors
            ${item.destructive 
                ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300' 
                : 'text-textMain/80 hover:bg-brand/10 hover:text-textMain'
            }
          `}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
};