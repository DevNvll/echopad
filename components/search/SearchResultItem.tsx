import { useMemo, Fragment } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FolderOpen, Clock, Link2, Star, Image as ImageIcon, Check } from 'lucide-react'
import { clsx } from 'clsx'
import { Note } from '../../types'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { NoteImage } from '../NoteImage'
import { useVaultStore } from '../../stores'

interface SearchResultItemProps {
  note: Note
  query: string
  onClick: () => void
  onTagClick: (tag: string) => void
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function formatRelativeDate(timestamp: number): string {
  const date = new Date(timestamp)
  if (isToday(date)) {
    return `Today at ${format(date, 'h:mm a')}`
  }
  if (isYesterday(date)) {
    return `Yesterday at ${format(date, 'h:mm a')}`
  }
  const distance = formatDistanceToNow(date, { addSuffix: true })
  if (
    distance.includes('day') ||
    distance.includes('hour') ||
    distance.includes('minute')
  ) {
    return distance
  }
  return format(date, 'MMM d, yyyy')
}

function truncateContent(content: string, maxLength: number = 300): string {
  const lines = content.split('\n').filter((line) => line.trim())
  let result = ''
  for (const line of lines) {
    if (result.length + line.length > maxLength) {
      if (result.length === 0) {
        result = line.slice(0, maxLength) + '...'
      }
      break
    }
    result += (result ? '\n' : '') + line
  }
  return result || content.slice(0, maxLength)
}

function HighlightText({
  text,
  query
}: {
  text: string
  query: string
}): JSX.Element {
  if (!query) return <>{text}</>

  const searchTerm = query.replace(/^#/, '')
  if (!searchTerm) return <>{text}</>

  const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi')
  const parts = text.split(regex)

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-brand/30 text-textMain rounded px-0.5 -mx-0.5"
          >
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  )
}

export function SearchResultItem({
  note,
  query,
  onClick,
  onTagClick
}: SearchResultItemProps) {
  const { vaultPath } = useVaultStore()
  const relativeDate = formatRelativeDate(note.createdAt)
  const notebookDisplay = note.notebookName.split('/').pop() || note.notebookName
  const hasImage = /!\[.*?\]\(.*?\)/.test(note.content)

  const previewContent = useMemo(() => {
    return truncateContent(note.content)
  }, [note.content])

  const markdownComponents = useMemo(
    () => ({
      h1: ({ children }: any) => (
        <span className="font-bold text-textMain">
          <HighlightText text={String(children)} query={query} />
        </span>
      ),
      h2: ({ children }: any) => (
        <span className="font-bold text-textMain">
          <HighlightText text={String(children)} query={query} />
        </span>
      ),
      h3: ({ children }: any) => (
        <span className="font-semibold text-textMain">
          <HighlightText text={String(children)} query={query} />
        </span>
      ),
      p: ({ children }: any) => (
        <span>
          {typeof children === 'string' ? (
            <HighlightText text={children} query={query} />
          ) : (
            children
          )}
        </span>
      ),
      strong: ({ children }: any) => (
        <strong className="font-semibold text-textMain">
          <HighlightText text={String(children)} query={query} />
        </strong>
      ),
      em: ({ children }: any) => (
        <em className="italic">
          <HighlightText text={String(children)} query={query} />
        </em>
      ),
      code: ({ children, className }: any) => {
        const isBlock = className?.includes('language-')
        if (isBlock) {
          return (
            <code className="text-[11px] bg-black/30 text-textMuted/70 px-1 py-0.5 rounded">
              [code block]
            </code>
          )
        }
        return (
          <code className="text-[11px] bg-surfaceHighlight/50 text-accent px-1 py-0.5 rounded font-mono">
            <HighlightText text={String(children)} query={query} />
          </code>
        )
      },
      pre: () => (
        <span className="text-[11px] text-textMuted/50">[code]</span>
      ),
      a: ({ href, children }: any) => (
        <span className="text-brand">
          <HighlightText text={String(children)} query={query} />
        </span>
      ),
      ul: ({ children }: any) => <span>{children}</span>,
      ol: ({ children }: any) => <span>{children}</span>,
      li: ({ children, className }: any) => {
        const isTaskItem = className?.includes('task-list-item')
        return (
          <span className={isTaskItem ? '' : undefined}>
            {!isTaskItem && '• '}
            {typeof children === 'string' ? (
              <HighlightText text={children} query={query} />
            ) : (
              children
            )}{' '}
          </span>
        )
      },
      input: ({ type, checked }: any) => {
        if (type === 'checkbox') {
          const isChecked = checked === true
          return (
            <span
              className={clsx(
                'inline-flex items-center justify-center w-3 h-3 rounded border mr-1 align-middle',
                isChecked
                  ? 'bg-brand border-brand text-white'
                  : 'border-border/60 bg-transparent'
              )}
            >
              {isChecked && <Check className="w-2 h-2" strokeWidth={3} />}
            </span>
          )
        }
        return null
      },
      blockquote: ({ children }: any) => (
        <span className="text-textMuted/70 italic border-l-2 border-brand/30 pl-2">
          {children}
        </span>
      ),
      img: ({ src, alt }: any) => {
        if (
          src &&
          vaultPath &&
          !src.startsWith('http://') &&
          !src.startsWith('https://') &&
          !src.startsWith('data:')
        ) {
          return (
            <span className="inline-block align-middle mr-1">
              <NoteImage
                src={src}
                alt={alt}
                vaultPath={vaultPath}
                className="h-12 w-auto rounded object-cover inline-block"
              />
            </span>
          )
        }
        return (
          <img
            src={src}
            alt={alt || ''}
            className="h-12 w-auto rounded object-cover inline-block align-middle mr-1"
          />
        )
      }
    }),
    [query, vaultPath]
  )

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg bg-surface/50 border border-border/30 hover:border-brand/30 hover:bg-surface/80 transition-all group"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <FolderOpen size={11} className="text-brand/60 shrink-0" />
          <span className="text-[10px] text-textMuted/70 truncate font-medium">
            {notebookDisplay}
          </span>
          {note.isFavorite && (
            <Star
              size={9}
              className="text-amber-400 fill-amber-400 shrink-0"
            />
          )}
          {hasImage && (
            <ImageIcon size={9} className="text-textMuted/40 shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {note.hasLink && <Link2 size={10} className="text-textMuted/40" />}
          <div className="flex items-center gap-1 text-textMuted/40">
            <Clock size={10} />
            <span className="text-[9px]">{relativeDate}</span>
          </div>
        </div>
      </div>

      <div className="text-[12px] text-textMain/80 leading-relaxed line-clamp-3 markdown-preview">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {previewContent}
        </ReactMarkdown>
      </div>

      {note.tags && note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {note.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              onClick={(e) => {
                e.stopPropagation()
                onTagClick(tag)
              }}
              className={clsx(
                'text-[9px] px-1 py-0.5 rounded transition-colors cursor-pointer',
                query.toLowerCase() === `#${tag.toLowerCase()}`
                  ? 'bg-brand/20 text-brand'
                  : 'text-textMuted/60 hover:text-brand bg-surfaceHighlight/30'
              )}
            >
              #{tag}
            </span>
          ))}
          {note.tags.length > 5 && (
            <span className="text-[9px] text-textMuted/40">
              +{note.tags.length - 5}
            </span>
          )}
        </div>
      )}
    </button>
  )
}
