import { useState, useEffect } from 'react'
import { AlertTriangle, FileText, Check, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { useSyncStore } from '../../stores/syncStore'
import type { ConflictInfo, ConflictResolution } from '../../types/sync'

interface ConflictResolverProps {
  vaultPath: string
}

export function ConflictResolver({ vaultPath }: ConflictResolverProps) {
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedConflict, setExpandedConflict] = useState<string | null>(null)
  const [resolvingPath, setResolvingPath] = useState<string | null>(null)
  const { getConflicts, resolveConflict } = useSyncStore()

  useEffect(() => {
    loadConflicts()
  }, [vaultPath])

  const loadConflicts = async () => {
    setIsLoading(true)
    try {
      const conflictList = await getConflicts(vaultPath)
      setConflicts(conflictList)
    } catch (error) {
      console.error('Failed to load conflicts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResolve = async (conflictPath: string, keep: ConflictResolution) => {
    setResolvingPath(conflictPath)
    try {
      await resolveConflict(vaultPath, conflictPath, keep)
      setConflicts((prev) => prev.filter((c) => c.conflict_path !== conflictPath))
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
    } finally {
      setResolvingPath(null)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  if (conflicts.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-500/10 flex items-center justify-center">
          <Check className="w-6 h-6 text-green-400" />
        </div>
        <p className="text-sm text-[var(--text-secondary)]">No sync conflicts</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-amber-400 mb-4">
        <AlertTriangle className="w-5 h-5" />
        <span className="text-sm font-medium">
          {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} found
        </span>
      </div>

      {conflicts.map((conflict) => {
        const isExpanded = expandedConflict === conflict.conflict_path
        const isResolving = resolvingPath === conflict.conflict_path

        return (
          <div
            key={conflict.conflict_path}
            className="rounded-lg border border-amber-500/20 bg-amber-500/5 overflow-hidden"
          >
            <button
              onClick={() => setExpandedConflict(isExpanded ? null : conflict.conflict_path)}
              className="w-full p-3 flex items-center justify-between hover:bg-amber-500/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-amber-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {conflict.original_path}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Conflict created {formatDate(conflict.created_at)}
                  </p>
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-[var(--text-tertiary)]" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[var(--text-tertiary)]" />
              )}
            </button>

            {isExpanded && (
              <div className="px-3 pb-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
                    <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Local Version
                    </p>
                    <p className="text-sm text-[var(--text-primary)]">
                      Modified {formatDate(conflict.local_modified_at)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
                    <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Remote Version
                    </p>
                    <p className="text-sm text-[var(--text-primary)]">
                      Modified {formatDate(conflict.remote_modified_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleResolve(conflict.conflict_path, 'local')}
                    disabled={isResolving}
                    className="flex-1 py-2 px-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isResolving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Keep Local
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleResolve(conflict.conflict_path, 'remote')}
                    disabled={isResolving}
                    className="flex-1 py-2 px-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isResolving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Keep Remote
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleResolve(conflict.conflict_path, 'both')}
                    disabled={isResolving}
                    className="py-2 px-3 rounded-lg bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 text-sm text-[var(--accent-color)] hover:bg-[var(--accent-color)]/20 transition-colors disabled:opacity-50"
                  >
                    Keep Both
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

