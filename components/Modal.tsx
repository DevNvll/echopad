import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
  isDestructive?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  onSubmit, 
  submitLabel = 'Save',
  isDestructive = false
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      <div 
        ref={modalRef}
        className="relative w-full max-w-md bg-[#111113] border border-border rounded-xl shadow-2xl transform transition-all animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between p-5 border-b border-border/40">
          <h2 className="text-lg font-bold text-textMain tracking-tight">{title}</h2>
          <button 
            onClick={onClose}
            className="text-textMuted hover:text-textMain transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-5">
          {children}
        </div>

        <div className="p-4 bg-surfaceHighlight/30 rounded-b-xl flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-textMain hover:underline transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={onSubmit}
            className={`px-5 py-2 text-sm font-medium rounded-md text-white shadow-lg transition-all active:scale-95 ${
              isDestructive 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-brand hover:bg-brand/90'
            }`}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
};