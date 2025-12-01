import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { ArrowUp, Folder } from 'lucide-react'
import { clsx } from 'clsx'
import {
  getVaultPath,
  listNotebooks,
  createNote,
  getQuickCaptureNotebook,
  setQuickCaptureNotebook,
  syncNoteTags,
  getVaultAccentColor
} from '../../api'
import { Notebook } from '../../types'

export const QuickCapture: React.FC = () => {
  const [content, setContent] = useState('')
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  const handleClose = useCallback(async () => {
    try {
      await invoke('hide_quick_capture')
    } catch (err) {
      const window = getCurrentWindow()
      await window.hide()
    }
  }, [])

  const flattenNotebooks = (nbs: Notebook[]): Notebook[] => {
    const result: Notebook[] = []
    for (const nb of nbs) {
      result.push(nb)
      if (nb.children) {
        result.push(...flattenNotebooks(nb.children))
      }
    }
    return result
  }

  // Get sorted notebooks - pinned first, then others
  const sortedNotebooks = useMemo(() => {
    const flat = flattenNotebooks(notebooks)
    const pinned = flat.filter((nb) => nb.isPinned)
    const unpinned = flat.filter((nb) => !nb.isPinned)
    return [...pinned, ...unpinned]
  }, [notebooks])

  const selectedNotebook = sortedNotebooks[selectedIndex]?.relativePath || null
  const selectedNotebookName =
    sortedNotebooks[selectedIndex]?.name || 'No notebook'

  // Initialize data
  useEffect(() => {
    const init = async () => {
      try {
        const vault = await getVaultPath()
        if (!vault) {
          setError('No vault configured. Please open the main app first.')
          setIsLoading(false)
          return
        }
        setVaultPath(vault)

        // Apply accent color
        const accentColor = await getVaultAccentColor(vault)
        if (accentColor) {
          document.documentElement.style.setProperty(
            '--accent-color',
            accentColor
          )
        }

        const nbs = await listNotebooks(vault)
        setNotebooks(nbs)

        // Get last used notebook or default to first
        const lastNotebook = await getQuickCaptureNotebook()
        const flatNbs = flattenNotebooks(nbs)
        const pinned = flatNbs.filter((nb) => nb.isPinned)
        const unpinned = flatNbs.filter((nb) => !nb.isPinned)
        const sorted = [...pinned, ...unpinned]

        if (lastNotebook) {
          const idx = sorted.findIndex((nb) => nb.relativePath === lastNotebook)
          if (idx >= 0) setSelectedIndex(idx)
        }

        setIsLoading(false)
      } catch (err) {
        console.error('Failed to initialize quick capture:', err)
        setError('Failed to load data')
        setIsLoading(false)
      }
    }
    init()
  }, [])

  // Handle window focus changes
  useEffect(() => {
    const window = getCurrentWindow()
    const unlisten = window.onFocusChanged(({ payload: focused }) => {
      if (focused) {
        // Reset state when window is shown again
        setIsSaving(false)
        setShowSuccess(false)
        setError(null)
        // Re-focus input
        setTimeout(() => inputRef.current?.focus(), 50)
      } else if (!isSaving) {
        // Close on blur (click outside)
        handleClose()
      }
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [handleClose, isSaving])

  // Auto-focus input when ready
  useEffect(() => {
    if (!isLoading && !error && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isLoading, error])

  const cycleNotebook = (direction: 1 | -1) => {
    if (sortedNotebooks.length === 0) return
    setSelectedIndex((prev) => {
      const next = prev + direction
      if (next < 0) return sortedNotebooks.length - 1
      if (next >= sortedNotebooks.length) return 0
      return next
    })
  }

  const handleSave = async () => {
    if (!vaultPath || !selectedNotebook || !content.trim()) return

    setIsSaving(true)
    try {
      const note = await createNote(vaultPath, selectedNotebook, content.trim())
      await syncNoteTags(note)
      await setQuickCaptureNotebook(selectedNotebook)

      setShowSuccess(true)
      setContent('')

      // Close window after brief delay
      setTimeout(async () => {
        await handleClose()
        setShowSuccess(false)
      }, 600)
    } catch (err) {
      console.error('Failed to save note:', err)
      setError('Failed to save note')
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      handleClose()
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
      return
    }

    // Tab cycles through notebooks
    if (e.key === 'Tab') {
      e.preventDefault()
      cycleNotebook(e.shiftKey ? -1 : 1)
    }
  }

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-transparent font-sans">
        <div className="flex items-center justify-center h-full w-full rounded-xl border border-border/60 bg-background/95 backdrop-blur-xl">
          <div className="text-textMuted text-xs">Loading...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen w-screen bg-transparent font-sans">
        <div className="flex items-center justify-center gap-3 h-full w-full rounded-xl border border-border/60 bg-background/95 backdrop-blur-xl px-4">
          <div className="text-red-400 text-xs">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="h-screen w-screen bg-transparent font-sans"
      onKeyDown={handleKeyDown}
    >
      <div
        className={clsx(
          'flex items-center h-full w-full rounded-xl border bg-background/95 backdrop-blur-xl overflow-hidden transition-all duration-200 px-2 gap-2',
          showSuccess
            ? 'border-green-500/50 shadow-[0_0_20px_-5px_rgba(34,197,94,0.3)]'
            : 'border-border/60 shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)]'
        )}
      >
        {/* Notebook - Tab to cycle */}
        <div className="flex items-center gap-1.5 px-2 shrink-0 text-xs text-textMuted">
          <Folder size={12} />
          <span className="truncate max-w-[80px]">{selectedNotebookName}</span>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-border/60" />

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Quick note... (Tab to change notebook)"
          disabled={isSaving}
          autoComplete="off"
          className={clsx(
            'flex-1 bg-transparent text-textMain text-sm h-full',
            'placeholder-textMuted/40',
            'focus:outline-none',
            'disabled:opacity-50'
          )}
        />

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!content.trim() || isSaving || !selectedNotebook}
          className={clsx(
            'flex items-center justify-center w-7 h-7 rounded-lg transition-all shrink-0',
            'disabled:opacity-20 disabled:cursor-not-allowed',
            showSuccess
              ? 'bg-green-500 text-white'
              : 'bg-brand text-background hover:opacity-90 active:scale-95'
          )}
        >
          <ArrowUp size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
