export interface TodoItem {
  index: number
  checked: boolean
  text: string
  lineStart: number
  lineEnd: number
  fullMatch: string
}

export interface ParsedMarkdown {
  todos: TodoItem[]
  content: string
}

const TODO_REGEX = /^(\s*)[-*]\s+\[([ xX])\]\s+(.*)$/gm

export function parseTodos(content: string): TodoItem[] {
  const todos: TodoItem[] = []
  let match: RegExpExecArray | null
  let index = 0

  const regex = new RegExp(TODO_REGEX.source, 'gm')

  while ((match = regex.exec(content)) !== null) {
    const lineStart = content.lastIndexOf('\n', match.index) + 1
    const lineEnd = content.indexOf('\n', match.index)

    todos.push({
      index,
      checked: match[2].toLowerCase() === 'x',
      text: match[3],
      lineStart: match.index,
      lineEnd: lineEnd === -1 ? content.length : lineEnd,
      fullMatch: match[0]
    })
    index++
  }

  return todos
}

export function toggleTodo(content: string, todoIndex: number): string {
  const todos = parseTodos(content)
  const todo = todos[todoIndex]

  if (!todo) {
    return content
  }

  const newCheckbox = todo.checked ? '[ ]' : '[x]'
  const newLine = todo.fullMatch.replace(/\[([ xX])\]/, newCheckbox)

  return (
    content.slice(0, todo.lineStart) +
    newLine +
    content.slice(todo.lineEnd)
  )
}

export function getTodoStats(content: string): { total: number; completed: number } {
  const todos = parseTodos(content)
  return {
    total: todos.length,
    completed: todos.filter(t => t.checked).length
  }
}

export function hasTodos(content: string): boolean {
  return TODO_REGEX.test(content)
}

export function extractTodoItems(content: string): Array<{ checked: boolean; text: string }> {
  return parseTodos(content).map(({ checked, text }) => ({ checked, text }))
}

export function createTodoItem(text: string, checked = false): string {
  return `- [${checked ? 'x' : ' '}] ${text}`
}

export function insertTodoAtCursor(
  content: string,
  cursorPosition: number,
  text: string,
  checked = false
): { content: string; newCursorPosition: number } {
  const todoLine = createTodoItem(text, checked)
  const before = content.slice(0, cursorPosition)
  const after = content.slice(cursorPosition)

  const needsNewlineBefore = before.length > 0 && !before.endsWith('\n')
  const needsNewlineAfter = after.length > 0 && !after.startsWith('\n')

  const newContent =
    before +
    (needsNewlineBefore ? '\n' : '') +
    todoLine +
    (needsNewlineAfter ? '\n' : '') +
    after

  const newCursorPosition =
    before.length +
    (needsNewlineBefore ? 1 : 0) +
    todoLine.length

  return { content: newContent, newCursorPosition }
}
