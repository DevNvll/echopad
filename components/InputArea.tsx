import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { ArrowUp, ImagePlus, Maximize2, Minimize2, Eye, EyeOff } from 'lucide-react'
import { saveImage } from '../api'
import {
  useVaultStore,
  useNotebookStore,
  useNotesStore,
  useTagsStore
} from '../stores'
import { useCommandStore } from '../stores/commandStore'
import { useMarkdownComponents } from './message-list/useMarkdownComponents'
import { Button } from '@/components/ui/button'
import { CommandAutocomplete } from './CommandAutocomplete'
import { CommandContext } from '../types/chatCommands'

export const InputArea: React.FC = () => {
  const { vaultPath } = useVaultStore()
  const { activeNotebook, currentNotebook } = useNotebookStore()
  const { createNote } = useNotesStore()
  const { syncNoteTags } = useTagsStore()
  const { executeCommand } = useCommandStore()

  const notebook = currentNotebook()
  const channelName = notebook?.name || 'unknown'

  const [content, setContent] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [showCommandAutocomplete, setShowCommandAutocomplete] = useState(false)
  const [commandError, setCommandError] = useState<string | null>(null)
  const [inputContainerHeight, setInputContainerHeight] = useState(0)
  const [commandPlaceholder, setCommandPlaceholder] = useState<string>('')
  const errorContentRef = useRef<string>('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputContainerRef = useRef<HTMLDivElement>(null)

  // Reuse existing markdown rendering components
  const markdownComponents = useMarkdownComponents(vaultPath)

  useEffect(() => {
    const trimmed = content.trim()
    const isCommand = trimmed.startsWith('/') && !trimmed.startsWith('//')
    setShowCommandAutocomplete(isCommand)

    if (isCommand) {
      const withoutSlash = trimmed.slice(1)
      const parts = withoutSlash.split(/\s+/).filter(Boolean)
      const commandName = parts[0]?.toLowerCase()

      if (commandName && withoutSlash.includes(' ')) {
        const { getCommand } = useCommandStore.getState()
        const command = getCommand(commandName)

        if (command?.usage) {
          const usageParts = command.usage.split(/\s+/).slice(1)
          const currentArgCount = parts.length - 1

          if (currentArgCount < usageParts.length) {
            const nextArg = usageParts[currentArgCount]
            setCommandPlaceholder(nextArg || '')
          } else {
            setCommandPlaceholder('')
          }
        } else {
          setCommandPlaceholder('')
        }
      } else {
        setCommandPlaceholder('')
      }
    } else {
      setCommandPlaceholder('')
    }
  }, [content])

  useEffect(() => {
    if (commandError && content !== errorContentRef.current) {
      setCommandError(null)
      errorContentRef.current = ''
    }
  }, [content, commandError])

  const handleCommandExecution = async (commandString: string) => {
    const context: CommandContext = {
      notebookName: activeNotebook,
      vaultPath,
    }

    setCommandError(null)
    errorContentRef.current = ''

    try {
      const result = await executeCommand(commandString, context)

      if (!result.success) {
        if (result.message) {
          setCommandError(result.message)
          errorContentRef.current = content
        }
        return
      }

      if (result.insertContent !== undefined) {
        setContent(result.insertContent)
        setTimeout(() => textareaRef.current?.focus(), 0)
      }

      if (result.createNote && result.noteContent) {
        await createNote(vaultPath!, activeNotebook!, result.noteContent)
      }

      if (result.clearInput) {
        setContent('')
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Command execution failed'
      setCommandError(errorMessage)
      errorContentRef.current = content
      console.error('Command execution error:', error)
    }
  }

  // Auto-resize textarea based on content (only when not expanded)
  useEffect(() => {
    if (textareaRef.current && !isExpanded) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        300
      )}px`
    }
  }, [content, isExpanded])

  // Reset height when toggling expansion
  useEffect(() => {
    if (textareaRef.current) {
      if (isExpanded) {
        textareaRef.current.style.height = ''
      } else {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = `${Math.min(
          textareaRef.current.scrollHeight,
          300
        )}px`
      }
    }
  }, [isExpanded])

  // Listen for focus-input event from keyboard shortcuts
  useEffect(() => {
    const handleFocusInput = () => {
      setIsPreviewMode(false) // Exit preview mode when focusing input
      setTimeout(() => textareaRef.current?.focus(), 0)
    }
    window.addEventListener('focus-input', handleFocusInput)
    return () => window.removeEventListener('focus-input', handleFocusInput)
  }, [])

  // Auto-focus input when selecting a notebook
  useEffect(() => {
    if (activeNotebook) {
      setIsPreviewMode(false)
      setTimeout(() => textareaRef.current?.focus(), 0)
    }
  }, [activeNotebook])

  useEffect(() => {
    const container = inputContainerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setInputContainerHeight(entry.contentRect.height)
      }
    })

    resizeObserver.observe(container)
    setInputContainerHeight(container.offsetHeight)

    return () => resizeObserver.disconnect()
  }, [])

  const handleSendMessage = async () => {
    if (!vaultPath || !activeNotebook || !content.trim()) return

    const trimmed = content.trim()
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      await handleCommandExecution(trimmed)
      return
    }

    const newNote = await createNote(vaultPath, activeNotebook, content)
    await syncNoteTags(newNote)
    setContent('')
    setIsPreviewMode(false) // Reset preview mode after sending
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showCommandAutocomplete && !isPreviewMode && ['ArrowDown', 'ArrowUp', 'Tab', 'Escape'].includes(e.key)) {
      if (e.key === 'Tab') {
        e.preventDefault()
      }
      return
    }

    if (isPreviewMode && showCommandAutocomplete && !['Escape', 'Enter'].includes(e.key) && !e.ctrlKey && !e.metaKey) {
      setIsPreviewMode(false)
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
    // Escape to collapse expanded input or exit preview mode
    if (e.key === 'Escape') {
      e.preventDefault()
      if (isPreviewMode) {
        setIsPreviewMode(false)
      } else if (isExpanded) {
        setIsExpanded(false)
      }
    }
    // Ctrl/Cmd+Shift+P to toggle preview
    if (e.key === 'p' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
      e.preventDefault()
      setIsPreviewMode(!isPreviewMode)
    }
  }

  const insertImageMarkdown = (relativePath: string) => {
    const textarea = textareaRef.current
    if (!textarea) {
      setContent((prev) => prev + `![](${relativePath})`)
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const imageMarkdown = `![](${relativePath})`
    const newContent =
      content.substring(0, start) + imageMarkdown + content.substring(end)
    setContent(newContent)

    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + imageMarkdown.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const processImageFile = async (file: File) => {
    if (!vaultPath) return
    if (!file.type.startsWith('image/')) return

    setIsUploading(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      )

      const extension =
        file.name.split('.').pop()?.toLowerCase() ||
        file.type.split('/')[1] ||
        'png'

      const relativePath = await saveImage(vaultPath, base64, extension)
      insertImageMarkdown(relativePath)
    } catch (err) {
      console.error('Failed to save image:', err)
    } finally {
      setIsUploading(false)
    }
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          await processImageFile(file)
        }
        return
      }
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await processImageFile(file)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 flex justify-center w-full z-30 pointer-events-none">
      {commandError && (
        <div className="absolute left-0 right-0 mx-auto w-full max-w-4xl mb-1 pointer-events-auto z-40"
          style={{ bottom: `${inputContainerHeight + 8}px` }}
        >
          <div className="mx-4 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3 shadow-lg">
            <span className="text-red-400 text-sm flex-shrink-0 mt-0.5">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-red-300 leading-relaxed whitespace-pre-line">{commandError}</p>
            </div>
            <button
              onClick={() => {
                setCommandError(null)
                errorContentRef.current = ''
              }}
              className="text-red-400 hover:text-red-300 flex-shrink-0 p-1 -m-1 transition-colors"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {showCommandAutocomplete && (
        <CommandAutocomplete
          input={content}
          onSelect={(command, fullCommand) => {
            setContent(fullCommand)
            setIsPreviewMode(false)
            setTimeout(() => textareaRef.current?.focus(), 0)
          }}
          onClose={() => setShowCommandAutocomplete(false)}
          onExitPreview={() => {
            setIsPreviewMode(false)
            setTimeout(() => textareaRef.current?.focus(), 0)
          }}
          bottomOffset={inputContainerHeight + (commandError ? 60 : 0)}
          isExpanded={isExpanded}
          isPreviewMode={isPreviewMode}
        />
      )}

      <div
        ref={inputContainerRef}
        className={`w-full max-w-4xl bg-surfaceHighlight/80 backdrop-blur-xl border-t border-x rounded-t-2xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden pointer-events-auto transition-all duration-300 ease-out ${
          isExpanded ? 'h-[60vh]' : ''
        } ${
          showCommandAutocomplete
            ? 'border-purple-500/60 focus-within:border-purple-500/80 shadow-[0_0_20px_-5px_rgba(168,85,247,0.4)]'
            : 'border-border/60 focus-within:border-brand/30 focus-within:shadow-[0_0_15px_-5px_color-mix(in_srgb,var(--accent-color)_20%,transparent)]'
        }`}
      >
        <div className={`px-4 pt-4 pb-2 ${isExpanded ? 'flex-1 flex flex-col min-h-0' : ''}`}>
          {isPreviewMode ? (
            <div
              className={`w-full text-textMain/90 text-[14px] leading-relaxed overflow-y-auto custom-scrollbar markdown-content ${isExpanded ? 'flex-1 min-h-0' : 'min-h-[40px] max-h-[300px]'}`}
              onClick={() => setIsPreviewMode(false)}
            >
              {content.trim() ? (
                <ReactMarkdown components={markdownComponents}>
                  {content}
                </ReactMarkdown>
              ) : (
                <span className="text-textMuted/40 italic">Nothing to preview...</span>
              )}
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                commandPlaceholder
                  ? commandPlaceholder
                  : showCommandAutocomplete
                  ? 'Type command or select from list...'
                  : 'Type your message here...'
              }
              rows={1}
              autoComplete="off"
              className={`w-full bg-transparent text-textMain placeholder-textMuted/40 resize-none outline-none text-[15px] leading-relaxed overflow-y-auto font-sans custom-scrollbar transition-all duration-300 ${isExpanded ? 'flex-1 min-h-0' : 'min-h-[40px] max-h-[300px]'}`}
            />
          )}
        </div>

        <div className="flex items-center justify-between px-3 pb-3 mt-1">
          <div className="flex items-center gap-1">
            {showCommandAutocomplete && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-500/10 border border-purple-500/30 rounded text-purple-400 text-xs mr-1">
                <span className="font-mono">/</span>
                <span>command mode</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || !vaultPath}
              className="w-8 h-8 text-textMuted hover:text-textMain hover:bg-white/5 active:scale-95"
              title="Add image"
            >
              <ImagePlus size={18} strokeWidth={2} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-8 h-8 text-textMuted hover:text-textMain hover:bg-white/5 active:scale-95"
              title={isExpanded ? 'Collapse input' : 'Expand input'}
            >
              {isExpanded ? (
                <Minimize2 size={16} strokeWidth={2} />
              ) : (
                <Maximize2 size={16} strokeWidth={2} />
              )}
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className={`w-8 h-8 active:scale-95 ${isPreviewMode ? 'text-brand bg-brand/10' : 'text-textMuted hover:text-textMain hover:bg-white/5'}`}
              title={isPreviewMode ? 'Edit mode' : 'Preview markdown'}
            >
              {isPreviewMode ? (
                <EyeOff size={16} strokeWidth={2} />
              ) : (
                <Eye size={16} strokeWidth={2} />
              )}
            </Button>
            <Button
              size="icon"
              onClick={handleSendMessage}
              disabled={!content.trim() || isUploading}
              className="w-8 h-8 bg-brand text-background disabled:opacity-20 disabled:bg-white/10 disabled:text-textMuted hover:opacity-90 active:scale-95"
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
