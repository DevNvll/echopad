import { useState, useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Minus, Square, X, Copy, Search } from 'lucide-react'

interface TitleBarProps {
  onOpenCommandPalette?: () => void
}

export function TitleBar({ onOpenCommandPalette }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const appWindow = getCurrentWindow()

  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await appWindow.isMaximized()
      setIsMaximized(maximized)
    }
    checkMaximized()

    const unlisten = appWindow.onResized(async () => {
      const maximized = await appWindow.isMaximized()
      setIsMaximized(maximized)
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [appWindow])

  const handleMinimize = () => appWindow.minimize()
  const handleMaximize = () => appWindow.toggleMaximize()
  const handleClose = () => appWindow.close()

  return (
    <div className="h-9 flex items-center justify-between bg-sidebar border-b border-border/40 select-none rounded-t-lg">
      <div
        data-tauri-drag-region
        className="w-36 h-full flex items-center px-4 cursor-default shrink-0"
      >
        <span className="text-xs font-medium text-textMuted tracking-wide">
          lazuli
        </span>
      </div>

      <div data-tauri-drag-region className="flex-1 h-full flex items-center justify-center px-4">
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 h-6 w-full max-w-md bg-black/40 border border-border/50 rounded-md px-3 text-textMuted/50 hover:text-textMuted hover:border-border/80 hover:bg-black/60 transition-all cursor-pointer"
        >
          <Search size={12} />
          <span className="text-xs flex-1 text-left">Search...</span>
          <kbd className="hidden sm:inline-flex h-4 items-center gap-0.5 rounded border border-border/50 bg-surface/50 px-1 font-mono text-[9px] font-medium text-textMuted/50">
            Ctrl K
          </kbd>
        </button>
      </div>

      <div className="flex items-center h-full shrink-0">
        <button
          onClick={handleMinimize}
          className="h-full w-12 flex items-center justify-center text-textMuted hover:bg-white/5 transition-colors"
        >
          <Minus size={14} strokeWidth={1.5} />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full w-12 flex items-center justify-center text-textMuted hover:bg-white/5 transition-colors"
        >
          {isMaximized ? (
            <Copy size={12} strokeWidth={1.5} className="rotate-180" />
          ) : (
            <Square size={11} strokeWidth={1.5} />
          )}
        </button>
        <button
          onClick={handleClose}
          className="h-full w-12 flex items-center justify-center text-textMuted hover:bg-red-500 hover:text-white transition-colors"
        >
          <X size={15} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}

