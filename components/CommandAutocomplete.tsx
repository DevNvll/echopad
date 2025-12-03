import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useCommandStore } from '../stores/commandStore'
import { ChatCommand } from '../types/chatCommands'

interface CommandAutocompleteProps {
  input: string
  onSelect: (command: ChatCommand, fullCommand: string) => void
  onClose: () => void
  onExitPreview?: () => void
  bottomOffset?: number
  isExpanded?: boolean
  isPreviewMode?: boolean
}

export const CommandAutocomplete: React.FC<CommandAutocompleteProps> = ({
  input,
  onSelect,
  onClose,
  onExitPreview,
  bottomOffset = 0,
  isExpanded = false,
  isPreviewMode = false,
}) => {
  const { getAllCommands, getCommand } = useCommandStore()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [filteredCommands, setFilteredCommands] = useState<ChatCommand[]>([])
  const [argumentSuggestions, setArgumentSuggestions] = useState<string[]>([])
  const [currentCommand, setCurrentCommand] = useState<ChatCommand | null>(null)
  const [currentArgs, setCurrentArgs] = useState<string[]>([])
  const selectedItemRef = useRef<HTMLDivElement>(null)

  // Parse the input to extract command and args
  const parseInput = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed.startsWith('/')) return null

    const withoutSlash = trimmed.slice(1)
    const parts = withoutSlash.split(/\s+/).filter(Boolean)
    const commandName = parts[0]?.toLowerCase() || ''
    const args = parts.slice(1)

    return { commandName, args, hasSpace: withoutSlash.includes(' ') }
  }, [])

  useEffect(() => {
    const parsed = parseInput(input)
    if (!parsed) {
      setFilteredCommands([])
      setCurrentCommand(null)
      setCurrentArgs([])
      setArgumentSuggestions([])
      return
    }

    const { commandName, args, hasSpace } = parsed

    if (hasSpace) {
      const exactMatch = getCommand(commandName)
      if (exactMatch) {
        setCurrentCommand(exactMatch)
        setCurrentArgs(args)

        const lastArg = args[args.length - 1]
        const hasPartialArg = lastArg && lastArg.length > 0

        if (exactMatch.autocomplete && hasPartialArg) {
          import('../stores').then(({ useVaultStore, useNotebookStore }) => {
            const vaultPath = useVaultStore.getState().vaultPath
            const activeNotebook = useNotebookStore.getState().activeNotebook

            exactMatch
              .autocomplete(args, {
                notebookName: activeNotebook,
                vaultPath: vaultPath,
              })
              .then((suggestions) => {
                setArgumentSuggestions(suggestions)
                setFilteredCommands(suggestions.length > 0 ? [exactMatch] : [])
                setSelectedIndex(0)
              })
              .catch(() => {
                setArgumentSuggestions([])
                setFilteredCommands([])
              })
          })
        } else {
          setArgumentSuggestions([])
          setFilteredCommands([])
        }
      } else {
        setFilteredCommands([])
        setCurrentCommand(null)
        setCurrentArgs([])
        setArgumentSuggestions([])
      }
      return
    }

    setCurrentCommand(null)
    setCurrentArgs([])
    setArgumentSuggestions([])
    const allCommands = getAllCommands()
    const filtered = allCommands.filter((cmd) => {
      const nameMatch = cmd.name.toLowerCase().startsWith(commandName)
      const aliasMatch = cmd.aliases?.some((alias) =>
        alias.toLowerCase().startsWith(commandName)
      )
      return nameMatch || aliasMatch
    })

    setFilteredCommands(filtered.slice(0, 6))
    setSelectedIndex(0)
  }, [input, getAllCommands, getCommand, parseInput])

  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [selectedIndex])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (argumentSuggestions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % argumentSuggestions.length)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex((prev) =>
            prev === 0 ? argumentSuggestions.length - 1 : prev - 1
          )
        } else if (e.key === 'Tab') {
          e.preventDefault()
          const selected = argumentSuggestions[selectedIndex]
          if (selected && currentCommand) {
            const parsed = parseInput(input)
            if (parsed) {
              const argsWithoutLast = parsed.args.slice(0, -1)
              const newCommand = `/${currentCommand.name} ${[...argsWithoutLast, selected].join(' ')} `
              onSelect(currentCommand, newCommand)
            }
          }
        } else if (e.key === 'Escape') {
          e.preventDefault()
          onClose()
        }
        return
      }

      if (filteredCommands.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev === 0 ? filteredCommands.length - 1 : prev - 1
        )
      } else if (e.key === 'Tab') {
        e.preventDefault()
        const selected = filteredCommands[selectedIndex]
        if (selected) {
          onSelect(selected, `/${selected.name} `)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredCommands, argumentSuggestions, selectedIndex, onSelect, onClose, currentCommand, input, parseInput])

  if (filteredCommands.length === 0) return null

  return (
    <div
      className="absolute left-0 right-0 mx-auto w-full max-w-4xl bg-surfaceHighlight/95 backdrop-blur-xl border border-border/60 rounded-lg shadow-2xl overflow-hidden z-50 pointer-events-auto transition-all duration-200"
      style={{ bottom: `${bottomOffset + 8}px` }}
    >
      {isPreviewMode && (
        <div
          className="absolute inset-0 bg-surface/90 backdrop-blur-sm z-10 flex items-center justify-center cursor-pointer hover:bg-surface/95 transition-colors"
          onClick={() => onExitPreview?.()}
        >
          <div className="text-center px-6 py-4">
            <div className="text-sm text-textMain mb-2">Command detected in preview mode</div>
            <div className="text-xs text-textMuted">
              <kbd className="px-2 py-1 bg-white/10 rounded text-[11px] font-mono">Click here</kbd>
              {' '}or{' '}
              <kbd className="px-2 py-1 bg-white/10 rounded text-[11px] font-mono">start typing</kbd>
              {' '}to edit and use commands
            </div>
          </div>
        </div>
      )}
      {argumentSuggestions.length > 0 ? (
        <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
          {argumentSuggestions.map((suggestion, index) => {
            const isSelected = index === selectedIndex

            return (
              <div
                key={suggestion}
                ref={isSelected ? selectedItemRef : null}
                onClick={() => {
                  if (currentCommand) {
                    const parsed = parseInput(input)
                    if (parsed) {
                      const argsWithoutLast = parsed.args.slice(0, -1)
                      const newCommand = `/${currentCommand.name} ${[...argsWithoutLast, suggestion].join(' ')} `
                      onSelect(currentCommand, newCommand)
                    }
                  }
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`
                  px-4 py-2 cursor-pointer flex items-center gap-3 transition-colors
                  ${isSelected ? 'bg-brand/10 border-l-2 border-brand' : 'border-l-2 border-transparent hover:bg-white/5'}
                `}
              >
                <div className="flex-1 min-w-0">
                  <span
                    className={`font-mono text-sm ${isSelected ? 'text-brand' : 'text-textMain'}`}
                  >
                    {suggestion}
                  </span>
                </div>
                {isSelected && (
                  <div className="text-xs text-textMuted/60 flex-shrink-0">
                    Tab
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
          {filteredCommands.map((command, index) => {
            const Icon = command.icon
            const isSelected = index === selectedIndex

            return (
              <div
                key={command.name}
                ref={isSelected ? selectedItemRef : null}
                onClick={() => onSelect(command, `/${command.name} `)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`
                  px-4 py-2 cursor-pointer flex items-start gap-3 transition-colors
                  ${isSelected ? 'bg-brand/10 border-l-2 border-brand' : 'border-l-2 border-transparent hover:bg-white/5'}
                `}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {Icon ? (
                    <Icon
                      size={16}
                      className={isSelected ? 'text-brand' : 'text-textMuted'}
                    />
                  ) : (
                    <div className="w-[16px] h-[16px] rounded bg-white/5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span
                      className={`font-medium text-sm ${isSelected ? 'text-brand' : 'text-textMain'}`}
                    >
                      /{command.name}
                    </span>
                    {command.usage && (
                      <span className="text-xs text-textMuted/70 font-mono">
                        {command.usage.replace(`/${command.name}`, '').trim()}
                      </span>
                    )}
                    {command.aliases && command.aliases.length > 0 && (
                      <span className="text-xs text-textMuted/50">
                        ({command.aliases.map((a) => `/${a}`).join(', ')})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-textMuted/80 mt-0.5">
                    {command.description}
                  </div>
                </div>
                {isSelected && (
                  <div className="text-xs text-textMuted/60 flex-shrink-0 mt-0.5">
                    Tab
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {!currentCommand && (
        <div className="px-4 py-2 border-t border-border/30 bg-surface/50 text-xs text-textMuted flex items-center justify-between">
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] font-mono">
              ↑↓
            </kbd>{' '}
            navigate
            <kbd className="ml-3 px-1.5 py-0.5 bg-white/5 rounded text-[10px] font-mono">
              Tab
            </kbd>{' '}
            select
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] font-mono">
              Esc
            </kbd>{' '}
            close
          </span>
        </div>
      )}
    </div>
  )
}
