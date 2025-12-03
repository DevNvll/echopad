import React, { useMemo, memo } from 'react'
import { clsx } from 'clsx'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript'
import typescript from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript'
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python'
import rust from 'react-syntax-highlighter/dist/esm/languages/hljs/rust'
import css from 'react-syntax-highlighter/dist/esm/languages/hljs/css'
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json'
import bash from 'react-syntax-highlighter/dist/esm/languages/hljs/bash'
import sql from 'react-syntax-highlighter/dist/esm/languages/hljs/sql'
import xml from 'react-syntax-highlighter/dist/esm/languages/hljs/xml'
import { Check } from 'lucide-react'
import { NoteImage } from '../NoteImage'

// Register languages
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('js', javascript)
SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('ts', typescript)
SyntaxHighlighter.registerLanguage('python', python)
SyntaxHighlighter.registerLanguage('py', python)
SyntaxHighlighter.registerLanguage('rust', rust)
SyntaxHighlighter.registerLanguage('rs', rust)
SyntaxHighlighter.registerLanguage('css', css)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('sh', bash)
SyntaxHighlighter.registerLanguage('shell', bash)
SyntaxHighlighter.registerLanguage('sql', sql)
SyntaxHighlighter.registerLanguage('xml', xml)
SyntaxHighlighter.registerLanguage('html', xml)

const CodeBlock = memo(({ language, children }: { language: string; children: string }) => (
  <SyntaxHighlighter
    style={atomOneDark}
    language={language}
    PreTag="div"
    customStyle={{
      margin: 0,
      padding: '1rem',
      background: 'rgba(0, 0, 0, 0.4)',
      borderRadius: '0.5rem',
      fontSize: '0.875rem',
    }}
    codeTagProps={{
      style: {
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      }
    }}
  >
    {children}
  </SyntaxHighlighter>
))

export interface MarkdownComponentsOptions {
  vaultPath: string | null
  onToggleTodoRef?: React.MutableRefObject<((todoIndex: number) => void) | undefined>
}

export function useMarkdownComponents({ vaultPath, onToggleTodoRef }: MarkdownComponentsOptions) {
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
      code: ({ node, className, children, ...props }: any) => {
        const match = /language-(\w+)/.exec(className || '')
        
        if (match) {
          return (
            <CodeBlock language={match[1]}>
              {String(children).replace(/\n$/, '')}
            </CodeBlock>
          )
        }
        
        return (
          <code
            {...props}
            className={clsx(
              'bg-surfaceHighlight border border-border/50 rounded px-1.5 py-px text-[85%] font-mono text-accent',
              className
            )}
          >
            {children}
          </code>
        )
      },
      pre: ({ node, children, ...props }: any) => {
        // If the child is already a SyntaxHighlighter (code block with language), just render children
        const child = React.Children.toArray(children)[0]
        if (React.isValidElement(child) && child.type === 'div') {
          return <>{children}</>
        }
        return (
          <pre
            {...props}
            className="bg-black/40 border border-border/50 rounded-lg p-4 my-3 overflow-x-auto text-sm font-mono text-textMuted/90 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
          >
            {children}
          </pre>
        )
      },
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
      li: ({ node, children, className, ...props }: any) => {
        const isTaskItem = className?.includes('task-list-item')
        if (isTaskItem) {
          return <li {...props} className="list-none">{children}</li>
        }
        return <li {...props}>{children}</li>
      },
      input: ({ node, type, checked, disabled, ...props }: any) => {
        if (type === 'checkbox') {
          const isChecked = checked === true
          return (
            <button
              type="button"
              data-todo-checkbox="true"
              onClick={(e) => {
                e.stopPropagation()
                const container = e.currentTarget.closest('.markdown-content')
                if (!container) return
                const allCheckboxes = container.querySelectorAll('[data-todo-checkbox]')
                const index = Array.from(allCheckboxes).indexOf(e.currentTarget)
                onToggleTodoRef?.current?.(index)
              }}
              className={clsx(
                'mr-2 w-4 h-4 rounded border inline-flex items-center justify-center shrink-0 transition-all align-middle',
                isChecked
                  ? 'bg-brand border-brand text-white'
                  : 'border-border/60 hover:border-brand/60 bg-transparent'
              )}
              aria-checked={isChecked}
              role="checkbox"
            >
              {isChecked && <Check className="w-3 h-3" strokeWidth={3} />}
            </button>
          )
        }
        return <input type={type} checked={checked} {...props} />
      },
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
    [vaultPath, onToggleTodoRef]
  )
}


