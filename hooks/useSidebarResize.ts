import { useState, useCallback, useEffect, useRef } from 'react'
import { saveSetting, getSetting } from '../api'

interface UseSidebarResizeOptions {
  minWidth?: number
  maxWidth?: number
  defaultWidth?: number
}

interface UseSidebarResizeReturn {
  sidebarWidth: number
  setSidebarWidth: (width: number) => void
  isResizing: boolean
  startResizing: () => void
  isSidebarCollapsed: boolean
  setIsSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
}

export function useSidebarResize(
  options: UseSidebarResizeOptions = {}
): UseSidebarResizeReturn {
  const { minWidth = 200, maxWidth = 480, defaultWidth = 260 } = options

  const [sidebarWidth, setSidebarWidth] = useState(defaultWidth)
  const [isResizing, setIsResizing] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const widthRef = useRef(sidebarWidth)
  useEffect(() => {
    widthRef.current = sidebarWidth
  }, [sidebarWidth])

  const startResizing = useCallback(() => {
    setIsResizing(true)
  }, [])

  const stopResizing = useCallback(() => {
    setIsResizing(false)
    saveSetting('sidebarWidth', widthRef.current)
  }, [])

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = e.clientX
        if (newWidth >= minWidth && newWidth <= maxWidth) {
          setSidebarWidth(newWidth)
        }
      }
    },
    [isResizing, minWidth, maxWidth]
  )

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const newValue = !prev
      saveSetting('sidebarCollapsed', newValue)
      return newValue
    })
  }, [])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize)
      window.addEventListener('mouseup', stopResizing)
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
    } else {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    return () => {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isResizing, resize, stopResizing])

  return {
    sidebarWidth,
    setSidebarWidth,
    isResizing,
    startResizing,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    toggleSidebar
  }
}



