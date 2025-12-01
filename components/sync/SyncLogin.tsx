import { useState } from 'react'
import { X, Cloud, Loader2, Eye, EyeOff, Server } from 'lucide-react'
import { useSyncStore } from '../../stores/syncStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const DEFAULT_SERVER_URL = 'https://sync.echopad.0x48.dev'

interface SyncLoginProps {
  onClose: () => void
  onSuccess?: () => void
}

export function SyncLogin({ onClose, onSuccess }: SyncLoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL)
  const [showPassword, setShowPassword] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const { login, isLoading, error } = useSyncStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    if (!email || !password) {
      setLocalError('Please fill in all fields')
      return
    }

    try {
      await login(email, password, serverUrl)
      if (onSuccess) {
        onSuccess()
      } else {
        onClose()
      }
    } catch {
      // Error is handled by the store
    }
  }

  const displayError = localError || error

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-surface border border-[#222] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#222]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand/10">
              <Cloud className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Sign in to Sync</h2>
              <p className="text-xs text-neutral-400">
                End-to-end encrypted sync
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-textMuted hover:text-textMain"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {displayError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {displayError}
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-textMuted">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label className="text-textMuted">Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-textMuted hover:text-textMain"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Advanced options */}
          <div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="px-0 text-textMuted hover:text-textMain"
            >
              <Server className="w-4 h-4" />
              {showAdvanced ? 'Hide' : 'Show'} advanced options
            </Button>

            {showAdvanced && (
              <div className="mt-3 space-y-2">
                <Label className="text-textMuted">Server URL</Label>
                <Input
                  type="url"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://sync.echopad.0x48.dev"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-textMuted">
                  Use a custom sync server for self-hosting
                </p>
              </div>
            )}
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Sign In
          </Button>
        </form>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#222] bg-[#080808] rounded-b-xl">
          <p className="text-xs text-neutral-500 text-center">
            Your data is encrypted before leaving your device. We can never read
            your notes.
          </p>
        </div>
      </div>
    </div>
  )
}
