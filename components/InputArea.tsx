import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, ImagePlus } from 'lucide-react';
import { saveImage } from '../api';

interface InputAreaProps {
  channelName: string;
  onSendMessage: (content: string) => void;
  vaultPath: string | null;
}

export const InputArea: React.FC<InputAreaProps> = ({ channelName, onSendMessage, vaultPath }) => {
  const [content, setContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 300)}px`;
    }
  }, [content]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (content.trim()) {
        onSendMessage(content);
        setContent('');
      }
    }
  };

  const insertImageMarkdown = (relativePath: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent(prev => prev + `![](${relativePath})`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const imageMarkdown = `![](${relativePath})`;
    const newContent = content.substring(0, start) + imageMarkdown + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + imageMarkdown.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const processImageFile = async (file: File) => {
    if (!vaultPath) return;
    if (!file.type.startsWith('image/')) return;

    setIsUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      
      const extension = file.name.split('.').pop()?.toLowerCase() || 
        file.type.split('/')[1] || 'png';
      
      const relativePath = await saveImage(vaultPath, base64, extension);
      insertImageMarkdown(relativePath);
    } catch (err) {
      console.error('Failed to save image:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await processImageFile(file);
        }
        return;
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processImageFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="shrink-0 flex justify-center w-full bg-transparent z-20 relative">
      <div className="w-full max-w-4xl bg-surfaceHighlight border-t border-x border-border/40 rounded-t-2xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.8)] flex flex-col transition-all overflow-hidden group">
        
        <div className="px-4 pt-4 pb-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={`Message #${channelName}`}
            rows={1}
            className="w-full bg-transparent text-textMain placeholder-textMuted/40 resize-none outline-none text-[15px] leading-relaxed min-h-[40px] max-h-[300px] overflow-y-auto font-sans custom-scrollbar"
          />
        </div>

        <div className="flex items-center justify-between px-3 pb-3 mt-1">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || !vaultPath}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-textMuted hover:text-textMain hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
              title="Add image"
            >
              <ImagePlus size={18} strokeWidth={2} />
            </button>
          </div>

          <div>
             <button 
                onClick={() => {
                  if (content.trim()) {
                    onSendMessage(content);
                    setContent('');
                  }
                }}
                disabled={!content.trim() || isUploading}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-textMain text-background disabled:opacity-20 disabled:bg-white/10 disabled:text-textMuted transition-all hover:opacity-90 active:scale-95"
             >
                <ArrowUp size={18} strokeWidth={2.5} />
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};