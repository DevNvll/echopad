import { KanbanColumn, KanbanCard } from '../types'

export interface ParsedBoardContent {
  frontMatter: {
    type: string
    title?: string
  }
  columns: KanbanColumn[]
}

interface FrontMatterResult {
  frontMatter: Record<string, string>
  body: string
}

function parseFrontMatter(content: string): FrontMatterResult {
  const frontMatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/
  const match = content.match(frontMatterRegex)

  if (!match) {
    return { frontMatter: {}, body: content }
  }

  const [, yamlContent, body] = match
  const frontMatter: Record<string, string> = {}

  yamlContent.split('\n').forEach((line) => {
    const colonIndex = line.indexOf(':')
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim()
      const value = line.slice(colonIndex + 1).trim()
      frontMatter[key] = value
    }
  })

  return { frontMatter, body }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
}

function generateCardId(): string {
  return `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function extractTags(content: string): string[] {
  const tagRegex = /#(\w+)/g
  const tags: string[] = []
  let match

  while ((match = tagRegex.exec(content)) !== null) {
    tags.push(match[1])
  }

  return tags
}

export function parseKanbanMarkdown(content: string): ParsedBoardContent {
  const { frontMatter, body } = parseFrontMatter(content)

  const columns: KanbanColumn[] = []
  let currentColumn: KanbanColumn | null = null

  const lines = body.split('\n')

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (trimmedLine.startsWith('## ')) {
      if (currentColumn) {
        columns.push(currentColumn)
      }
      const title = trimmedLine.slice(3).trim()
      currentColumn = {
        id: slugify(title) || `col-${Date.now()}`,
        title,
        cards: []
      }
    } else if (trimmedLine.startsWith('- ') && currentColumn) {
      const cardContent = trimmedLine.slice(2).trim()
      if (cardContent) {
        currentColumn.cards.push({
          id: generateCardId(),
          content: cardContent,
          tags: extractTags(cardContent)
        })
      }
    }
  }

  if (currentColumn) {
    columns.push(currentColumn)
  }

  return {
    frontMatter: {
      type: frontMatter.type || 'kanban',
      title: frontMatter.title
    },
    columns
  }
}

export function serializeKanbanMarkdown(
  title: string,
  columns: KanbanColumn[]
): string {
  const lines: string[] = []

  lines.push('---')
  lines.push('type: kanban')
  lines.push(`title: ${title}`)
  lines.push('---')
  lines.push('')

  for (const column of columns) {
    lines.push(`## ${column.title}`)
    for (const card of column.cards) {
      lines.push(`- ${card.content}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
