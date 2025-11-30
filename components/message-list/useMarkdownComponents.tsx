import React, { useMemo } from 'react'
import { clsx } from 'clsx'
import { NoteImage } from '../NoteImage'

export function useMarkdownComponents(vaultPath: string | null) {
  return useMemo(
    () => ({
      h1: ({ node, ...props }: any) => (
        <h1
          {...props}
          className="text-2xl font-bold text-textMain mt-4 mb-2 pb-1 border-b border-border/50"
        />
      ),
      h2: ({ node, ...props }: any) => (
        <h2 {...props} className="text-xl font-bold text-textMain mt-3 mb-2" />
      ),
      h3: ({ node, ...props }: any) => (
        <h3 {...props} className="text-lg font-bold text-textMain mt-3 mb-1" />
      ),
      h4: ({ node, ...props }: any) => (
        <h4
          {...props}
          className="text-base font-bold text-textMain mt-2 mb-1"
        />
      ),
      strong: ({ node, ...props }: any) => (
        <strong {...props} className="font-semibold text-textMain" />
      ),
      em: ({ node, ...props }: any) => (
        <em {...props} className="italic text-textMain/90" />
      ),
      blockquote: ({ node, ...props }: any) => (
        <blockquote
          {...props}
          className="border-l-[3px] border-brand/40 pl-4 py-1 my-2 text-textMuted italic bg-surfaceHighlight/5 rounded-r"
        />
      ),
      code: ({ node, className, ...props }: any) => (
        <code
          {...props}
          className={clsx(
            'bg-surfaceHighlight border border-border/50 rounded px-1.5 py-px text-[85%] font-mono text-accent',
            className
          )}
        />
      ),
      pre: ({ node, ...props }: any) => (
        <pre
          {...props}
          className="bg-black/40 border border-border/50 rounded-lg p-4 my-3 overflow-x-auto text-sm font-mono text-textMuted/90 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
        />
      ),
      ul: ({ node, ...props }: any) => (
        <ul
          {...props}
          className="list-disc list-outside ml-5 mb-2 space-y-1 text-textMuted marker:text-brand/50"
        />
      ),
      ol: ({ node, ...props }: any) => (
        <ol
          {...props}
          className="list-decimal list-outside ml-5 mb-2 space-y-1 text-textMuted marker:text-brand/50"
        />
      ),
      a: ({ node, ...props }: any) => (
        <a
          {...props}
          className="text-brand hover:underline hover:text-accentHover transition-colors cursor-pointer"
          target="_blank"
          rel="noreferrer"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        />
      ),
      p: ({ node, ...props }: any) => (
        <p {...props} className="mb-1 last:mb-0" />
      ),
      img: ({ node, src, alt, ...props }: any) => {
        if (
          src &&
          vaultPath &&
          !src.startsWith('http://') &&
          !src.startsWith('https://') &&
          !src.startsWith('data:')
        ) {
          return <NoteImage src={src} alt={alt} vaultPath={vaultPath} />
        }
        return (
          <img
            src={src}
            alt={alt || ''}
            className="max-w-full h-auto rounded-lg my-2"
            {...props}
          />
        )
      }
    }),
    [vaultPath]
  )
}

