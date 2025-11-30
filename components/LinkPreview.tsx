import React, { useEffect, useState } from 'react'
import { ArrowUpRight, Globe, Loader2 } from 'lucide-react'
import { fetchOgMetadata } from '../api'
import { OgMetadata } from '../types'

interface LinkPreviewProps {
  url: string
}

export const LinkPreview: React.FC<LinkPreviewProps> = ({ url }) => {
  const [ogData, setOgData] = useState<OgMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [imageError, setImageError] = useState(false)

  let domain = ''
  try {
    domain = new URL(url).hostname.replace('www.', '')
  } catch (e) {
    domain = url
  }

  useEffect(() => {
    let cancelled = false
    
    const loadOgData = async () => {
      setLoading(true)
      setImageError(false)
      try {
        const data = await fetchOgMetadata(url)
        if (!cancelled) {
          setOgData(data)
        }
      } catch {
        // Keep ogData as null on error
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    
    loadOgData()
    
    return () => {
      cancelled = true
    }
  }, [url])

  const displayTitle = ogData?.title || domain
  const displayDescription = ogData?.description

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 block max-w-md group"
    >
      <div className="bg-black/40 border border-border/60 rounded-lg overflow-hidden transition-all group-hover:border-brand/40 group-hover:bg-surfaceHighlight/40 flex items-stretch">
        <div className="w-1 bg-border/50 group-hover:bg-brand/60 transition-colors flex-shrink-0"></div>
        
        <div className="flex-1 min-w-0 flex">
          {/* Content section */}
          <div className="p-3.5 flex-1 min-w-0">
            {loading ? (
              <div className="flex items-center gap-2 text-textMuted">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-xs">Loading preview...</span>
              </div>
            ) : (
              <>
                {/* Site info */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  {ogData?.favicon && !imageError ? (
                    <img 
                      src={ogData.favicon} 
                      alt="" 
                      className="w-4 h-4 rounded-sm"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <Globe size={14} className="text-textMuted/70" />
                  )}
                  <span className="text-[10px] font-medium text-textMuted/70 uppercase tracking-wide truncate">
                    {ogData?.siteName || domain}
                  </span>
                </div>
                
                {/* Title */}
                <div className="text-textMain text-[13px] font-medium leading-snug mb-1 line-clamp-2">
                  {displayTitle}
                </div>
                
                {/* Description */}
                {displayDescription && (
                  <div className="text-textMuted text-xs leading-relaxed line-clamp-2 mb-1.5">
                    {displayDescription}
                  </div>
                )}
                
                {/* URL */}
                <div className="flex items-center gap-1 text-brand/70 text-[11px] group-hover:text-brand transition-colors">
                  <span className="truncate">{url}</span>
                  <ArrowUpRight
                    size={10}
                    className="opacity-0 -translate-y-0.5 translate-x-0.5 group-hover:opacity-100 transition-all flex-shrink-0"
                  />
                </div>
              </>
            )}
          </div>
          
          {/* Image section */}
          {!loading && ogData?.image && !imageError && (
            <div className="w-[120px] flex-shrink-0 bg-black/20">
              <img
                src={ogData.image}
                alt=""
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            </div>
          )}
        </div>
      </div>
    </a>
  )
}
