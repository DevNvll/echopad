import { Hash, Tags } from 'lucide-react'
import { TagWithCount } from '../../api'

interface TagCloudProps {
  tags: TagWithCount[]
  onTagClick: () => void
}

function getTagSize(count: number, maxCount: number): string {
  const ratio = maxCount > 0 ? count / maxCount : 0
  if (ratio > 0.7) return 'text-sm font-medium'
  if (ratio > 0.4) return 'text-xs font-medium'
  return 'text-xs'
}

function getTagOpacity(count: number, maxCount: number): string {
  const ratio = maxCount > 0 ? count / maxCount : 0
  if (ratio > 0.7) return 'opacity-100'
  if (ratio > 0.4) return 'opacity-80'
  return 'opacity-60'
}

export function TagCloud({ tags, onTagClick }: TagCloudProps) {
  const topTags = tags.slice(0, 15)
  const maxCount = topTags.length > 0 ? Math.max(...topTags.map((t) => t.count)) : 0

  if (topTags.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-surface/30 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Tags size={14} className="text-textMuted/60" />
          <h2 className="text-sm font-medium text-textMain">Tags</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Hash className="text-textMuted/30 mb-2" size={24} strokeWidth={1.5} />
          <p className="text-xs text-textMuted/50">No tags yet</p>
          <p className="text-[10px] text-textMuted/40 mt-1">Add #tags to your notes</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/50 bg-surface/30 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Tags size={14} className="text-textMuted/60" />
        <h2 className="text-sm font-medium text-textMain">Tags</h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {topTags.map((tag) => (
          <button
            key={tag.tag}
            onClick={onTagClick}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surfaceHighlight/40 hover:bg-brand/20 border border-transparent hover:border-brand/30 transition-all ${getTagOpacity(tag.count, maxCount)}`}
          >
            <Hash size={10} className="text-brand/70" />
            <span className={`text-textMain/80 ${getTagSize(tag.count, maxCount)}`}>
              {tag.tag}
            </span>
            <span className="text-[9px] text-textMuted/50 ml-0.5">{tag.count}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

