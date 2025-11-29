import React from 'react'
import { ArrowUpRight } from 'lucide-react'

interface LinkPreviewProps {
  url: string
}

export const LinkPreview: React.FC<LinkPreviewProps> = ({ url }) => {
  let domain = ''
  try {
    domain = new URL(url).hostname.replace('www.', '')
  } catch (e) {
    domain = url
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 block max-w-md group"
    >
      <div className="bg-black/40 border border-border/60 rounded-lg overflow-hidden transition-all group-hover:border-brand/40 group-hover:bg-surfaceHighlight/40 flex items-stretch">
        <div className="w-1 bg-border/50 group-hover:bg-brand/60 transition-colors"></div>
        <div className="p-3.5 flex-1 min-w-0">
          <div className="text-[10px] font-bold text-textMuted/70 uppercase tracking-widest mb-1 flex items-center gap-1.5">
            LINK
          </div>
          <div className="text-brand/90 text-[13px] truncate font-mono mb-1">
            {url}
          </div>
          <div className="flex items-center gap-1 text-textMuted text-xs group-hover:text-textMain transition-colors">
            <span className="truncate max-w-[200px]">{domain}</span>
            <ArrowUpRight
              size={10}
              className="opacity-0 -translate-y-0.5 translate-x-0.5 group-hover:opacity-100 transition-all"
            />
          </div>
        </div>
      </div>
    </a>
  )
}
