import { useState, useEffect } from 'react'
import { RotateCcw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  getMetadataProxyUrl,
  setMetadataProxyUrl,
  DEFAULT_METADATA_PROXY_URL
} from '@/api'

export function AdvancedSettings() {
  const [proxyUrl, setProxyUrl] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    async function loadSettings() {
      const url = await getMetadataProxyUrl()
      setProxyUrl(url)
      setIsLoading(false)
    }
    loadSettings()
  }, [])

  const handleProxyUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProxyUrl(e.target.value)
  }

  const handleProxyUrlBlur = async () => {
    if (proxyUrl.trim()) {
      setIsSaving(true)
      await setMetadataProxyUrl(proxyUrl.trim())
      setIsSaving(false)
    }
  }

  const handleRevertToDefault = async () => {
    setIsSaving(true)
    setProxyUrl(DEFAULT_METADATA_PROXY_URL)
    await setMetadataProxyUrl(DEFAULT_METADATA_PROXY_URL)
    setIsSaving(false)
  }

  const isDefault = proxyUrl === DEFAULT_METADATA_PROXY_URL

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium text-textMain mb-1">
            Advanced Settings
          </h3>
          <p className="text-xs text-textMuted">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-textMain mb-1">
          Advanced Settings
        </h3>
        <p className="text-xs text-textMuted">
          Configure advanced options for power users
        </p>
      </div>
      <Separator className="bg-border/50" />

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="proxyUrl" className="text-sm text-textMain">
            Metadata Proxy URL
          </Label>
          <div className="flex gap-2">
            <Input
              id="proxyUrl"
              value={proxyUrl}
              onChange={handleProxyUrlChange}
              onBlur={handleProxyUrlBlur}
              placeholder="Enter metadata proxy URL"
              disabled={isSaving}
              className="flex-1 bg-surface border-border focus:border-brand/50 text-textMain placeholder:text-textMuted/50 font-mono text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevertToDefault}
              disabled={isDefault || isSaving}
              title="Revert to default"
            >
              <RotateCcw size={14} />
              Revert
            </Button>
          </div>
          <p className="text-xs text-textMuted">
            The proxy server used to fetch link preview metadata (Open Graph).
            {isDefault && <span className="text-brand ml-1">(default)</span>}
          </p>
        </div>
      </div>
    </div>
  )
}
