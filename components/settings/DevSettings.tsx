import { Bug, Terminal, Power, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useDevMode } from '@/hooks'

export function DevSettings() {
  const { disableDevMode } = useDevMode()
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  return (
    <div className="space-y-6 min-w-0 overflow-hidden">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Bug size={16} className="text-amber-400" />
          <h3 className="text-sm font-medium text-textMain">Developer Mode</h3>
        </div>
        <p className="text-xs text-textMuted">
          Advanced settings and debug information for developers
        </p>
      </div>
      <Separator className="bg-border/50" />

      {/* Status */}
      <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
        <div className="flex items-center gap-3">
          <Terminal size={20} className="text-amber-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-400">
              Developer Mode Active
            </p>
            <p className="text-xs text-amber-400/70">
              Activated via Konami code (↑↑↓↓←→←→BA)
            </p>
          </div>
        </div>
      </div>

      {/* Environment Info */}
      <div className="space-y-3 overflow-hidden">
        <h4 className="text-xs font-medium text-textMuted uppercase tracking-wider">
          Environment
        </h4>
        <div className="space-y-2 overflow-hidden">
          <InfoRow
            label="Platform"
            value={navigator.platform}
            onCopy={() => copyToClipboard(navigator.platform, 'platform')}
            copied={copiedField === 'platform'}
          />
          <InfoRow
            label="User Agent"
            value={navigator.userAgent}
            onCopy={() => copyToClipboard(navigator.userAgent, 'ua')}
            copied={copiedField === 'ua'}
            truncate
          />
          <InfoRow
            label="Window Size"
            value={`${window.innerWidth}×${window.innerHeight}`}
            onCopy={() =>
              copyToClipboard(`${window.innerWidth}×${window.innerHeight}`, 'size')
            }
            copied={copiedField === 'size'}
          />
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Disable Dev Mode */}
      <div className="pt-2">
        <Button
          variant="outline"
          onClick={disableDevMode}
          className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400"
        >
          <Power size={14} />
          Disable Developer Mode
        </Button>
        <p className="text-xs text-textMuted text-center mt-2">
          You can re-enable it anytime with the Konami code
        </p>
      </div>
    </div>
  )
}

interface InfoRowProps {
  label: string
  value: string
  onCopy: () => void
  copied: boolean
  truncate?: boolean
}

function InfoRow({ label, value, onCopy, copied, truncate }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 p-2.5 rounded-lg bg-surfaceHighlight/50 group overflow-hidden max-w-full">
      <span className="text-xs text-textMuted w-20 shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 min-w-0 overflow-hidden">
        <span
          className={`text-xs text-textMain font-mono block ${truncate ? 'truncate' : 'break-all'}`}
          title={value}
        >
          {value}
        </span>
      </div>
      <button
        onClick={onCopy}
        className="p-1 rounded text-textMuted hover:text-textMain hover:bg-surfaceHighlight opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        title="Copy"
      >
        {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
      </button>
    </div>
  )
}

