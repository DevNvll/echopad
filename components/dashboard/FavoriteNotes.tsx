import { Star, FileText, ArrowRight } from 'lucide-react'
import { Note } from '../../types'
import { formatMessageDate } from '../../utils/formatting'

interface FavoriteNotesProps {
  notes: Note[]
  onNoteClick: (notebookPath: string, filename: string) => void
}

function truncateContent(content: string, maxLength: number = 80): string {
  const cleaned = content.replace(/#\w+/g, '').trim()
  if (cleaned.length <= maxLength) return cleaned
  return cleaned.slice(0, maxLength).trim() + '...'
}

export function FavoriteNotes({ notes, onNoteClick }: FavoriteNotesProps) {
  if (notes.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-surface/30 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Star size={16} className="text-amber-400/60" />
          <h2 className="text-sm font-medium text-textMain">Favorite Notes</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <FileText className="text-textMuted/30 mb-3" size={32} strokeWidth={1.5} />
          <p className="text-sm text-textMuted/50">No favorites yet</p>
          <p className="text-xs text-textMuted/40 mt-1">Star notes to add them here</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/50 bg-surface/30 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Star size={16} className="text-amber-400" fill="currentColor" />
        <h2 className="text-sm font-medium text-textMain">Favorite Notes</h2>
        <span className="ml-auto text-[10px] text-textMuted/50 bg-surfaceHighlight/50 px-1.5 py-0.5 rounded">
          {notes.length}
        </span>
      </div>

      <div className="space-y-2">
        {notes.slice(0, 5).map((note) => (
          <button
            key={`${note.notebookName}-${note.filename}`}
            onClick={() => onNoteClick(note.notebookName, note.filename)}
            className="w-full text-left p-3 rounded-lg bg-surfaceHighlight/30 hover:bg-surfaceHighlight/60 border border-transparent hover:border-amber-400/20 transition-all group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-textMain/90 line-clamp-2 leading-relaxed">
                  {truncateContent(note.content)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-400 font-medium">
                    {note.notebookName.split('/').pop()}
                  </span>
                  <span className="text-[10px] text-textMuted/50">
                    {formatMessageDate(note.createdAt)}
                  </span>
                </div>
              </div>
              <ArrowRight 
                size={14} 
                className="text-textMuted/30 group-hover:text-amber-400/60 transition-colors mt-0.5 flex-shrink-0" 
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

