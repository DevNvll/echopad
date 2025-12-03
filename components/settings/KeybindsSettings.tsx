import { useState, useEffect, useCallback, useRef } from 'react'
import { RotateCcw, X } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  useKeybindsStore,
  DEFAULT_KEYBINDS,
  KeybindAction,
  Keybind
} from '@/stores'

const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

function formatKey(key: string): string {
  if (isMac) {
    switch (key.toLowerCase()) {
      case 'ctrl':
        return '⌘'
      case 'shift':
        return '⇧'
      case 'alt':
        return '⌥'
      case 'escape':
        return 'Esc'
      default:
        return key.length === 1 ? key.toUpperCase() : key
    }
  }
  if (key.toLowerCase() === 'escape') return 'Esc'
  return key.length === 1 ? key.toUpperCase() : key
}

function normalizeEventKey(key: string): string {
  const lower = key.toLowerCase()
  if (lower === 'control') return 'Ctrl'
  if (lower === 'meta') return 'Ctrl'
  if (lower === ' ') return 'Space'
  if (lower === 'escape') return 'Escape'
  if (lower === 'arrowup') return 'Up'
  if (lower === 'arrowdown') return 'Down'
  if (lower === 'arrowleft') return 'Left'
  if (lower === 'arrowright') return 'Right'
  if (key === ',') return ','
  if (key.length === 1) return key.toUpperCase()
  return key
}

interface KeybindRowProps {
  keybind: Keybind
  isEditing: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: (keys: string[]) => void
  onReset: () => void
  isDefault: boolean
}

function KeybindRow({
  keybind,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onReset,
  isDefault
}: KeybindRowProps) {
  const [capturedKeys, setCapturedKeys] = useState<string[]>([])
  const inputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  useEffect(() => {
    if (!isEditing) {
      setCapturedKeys([])
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        onCancelEdit()
        return
      }

      const keys: string[] = []
      if (e.ctrlKey || e.metaKey) keys.push('Ctrl')
      if (e.shiftKey) keys.push('Shift')
      if (e.altKey) keys.push('Alt')

      const mainKey = normalizeEventKey(e.key)
      if (!['Ctrl', 'Shift', 'Alt', 'Control', 'Meta'].includes(mainKey)) {
        keys.push(mainKey)
      }

      if (keys.length > 0) {
        setCapturedKeys(keys)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (capturedKeys.length > 0 && !['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        onSaveEdit(capturedKeys)
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
    }
  }, [isEditing, capturedKeys, onCancelEdit, onSaveEdit])

  return (
    <div className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-surfaceHighlight/30 transition-colors group">
      <div className="space-y-0.5 flex-1 min-w-0">
        <div className="text-sm font-medium text-textMain">{keybind.label}</div>
        <div className="text-xs text-textMuted">{keybind.description}</div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isEditing ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onCancelEdit}
          >
            <X size={14} />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 ${isDefault ? 'invisible' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}
            onClick={onReset}
            title="Reset to default"
          >
            <RotateCcw size={14} />
          </Button>
        )}

        {isEditing ? (
          <div
            ref={inputRef}
            tabIndex={0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md border-2 border-brand bg-brand/10 min-w-[120px] justify-center outline-none"
          >
            {capturedKeys.length > 0 ? (
              capturedKeys.map((key, index) => (
                <span key={index} className="flex items-center gap-1">
                  <kbd className="min-w-[24px] h-6 px-1.5 flex items-center justify-center rounded border border-brand/50 bg-surface text-xs font-mono text-brand">
                    {formatKey(key)}
                  </kbd>
                  {index < capturedKeys.length - 1 && (
                    <span className="text-brand/60 text-xs">+</span>
                  )}
                </span>
              ))
            ) : (
              <span className="text-xs text-brand/70">Press keys...</span>
            )}
          </div>
        ) : (
          <button
            onClick={onStartEdit}
            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-surfaceHighlight transition-colors min-w-[120px] justify-end"
          >
            {keybind.keys.map((key, index) => (
              <span key={index} className="flex items-center gap-1">
                <kbd className="min-w-[24px] h-6 px-1.5 flex items-center justify-center rounded border border-border bg-surface text-xs font-mono text-textMuted">
                  {formatKey(key)}
                </kbd>
                {index < keybind.keys.length - 1 && (
                  <span className="text-textMuted/40 text-xs">+</span>
                )}
              </span>
            ))}
          </button>
        )}
      </div>
    </div>
  )
}

export function KeybindsSettings() {
  const { keybinds, isLoaded, loadKeybinds, updateKeybind, resetKeybind, resetAllKeybinds } =
    useKeybindsStore()
  const [editingAction, setEditingAction] = useState<KeybindAction | null>(null)

  useEffect(() => {
    if (!isLoaded) {
      loadKeybinds()
    }
  }, [isLoaded, loadKeybinds])

  const handleSaveEdit = useCallback(
    async (action: KeybindAction, keys: string[]) => {
      await updateKeybind(action, keys)
      setEditingAction(null)
    },
    [updateKeybind]
  )

  const handleResetKeybind = useCallback(
    async (action: KeybindAction) => {
      await resetKeybind(action)
    },
    [resetKeybind]
  )

  const isKeybindDefault = (action: KeybindAction): boolean => {
    const current = keybinds[action]?.keys
    const defaultKeys = DEFAULT_KEYBINDS[action]?.keys
    if (!current || !defaultKeys) return true
    if (current.length !== defaultKeys.length) return false
    return current.every(
      (key, idx) => key.toLowerCase() === defaultKeys[idx].toLowerCase()
    )
  }

  const hasAnyCustomKeybinds = Object.keys(keybinds).some(
    (action) => !isKeybindDefault(action as KeybindAction)
  )

  const keybindActions: KeybindAction[] = [
    'commandPalette',
    'advancedSearch',
    'settings',
    'toggleSidebar',
    'newNote',
    'newNotebook',
    'closeModal'
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-textMain mb-1">
            Keyboard Shortcuts
          </h3>
          <p className="text-xs text-textMuted">
            Customize keyboard shortcuts. Click on a shortcut to edit it.
          </p>
        </div>
        {hasAnyCustomKeybinds && (
          <Button
            variant="outline"
            size="sm"
            onClick={resetAllKeybinds}
            className="text-xs"
          >
            <RotateCcw size={12} className="mr-1.5" />
            Reset All
          </Button>
        )}
      </div>
      <Separator className="bg-border/50" />

      <div className="space-y-1">
        {keybindActions.map((action) => {
          const keybind = keybinds[action]
          if (!keybind) return null

          return (
            <KeybindRow
              key={action}
              keybind={keybind}
              isEditing={editingAction === action}
              onStartEdit={() => setEditingAction(action)}
              onCancelEdit={() => setEditingAction(null)}
              onSaveEdit={(keys) => handleSaveEdit(action, keys)}
              onReset={() => handleResetKeybind(action)}
              isDefault={isKeybindDefault(action)}
            />
          )
        })}
      </div>

      <Separator className="bg-border/50" />

      <div className="text-xs text-textMuted/60 space-y-1">
        <p>
          {isMac ? '⌘ = Command, ⇧ = Shift, ⌥ = Option' : 'Ctrl = Control'}
        </p>
        <p>Click on a shortcut to change it. Press Escape to cancel.</p>
      </div>
    </div>
  )
}
