import { useState, useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Minus, Square, X, Copy } from 'lucide-react'

export function TitleBar() {
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
        className="flex-1 h-full flex items-center px-4 cursor-default"
      >
        <span className="text-xs font-medium text-textMuted tracking-wide">
          NoteCord
        </span>
      </div>

      <div className="flex items-center h-full">
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

