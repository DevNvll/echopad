# Claude AI Rules for Lazuli Project

This document contains all the rules and guidelines for AI assistance in this project.

## Workspace Rules

### Dependency Management
- **Always use pnpm** to add new dependencies
- **Before adding a dependency, ask for user input first**

## Project Overview

Lazuli (Echopad) is a local-first desktop note-taking application built with Tauri (Rust) and React (TypeScript). Follow these architectural patterns and conventions when making changes.

## Architecture Principles

### Local-First Design
- Notes are stored as plain markdown files in user-selected vault directories
- All data operations should work offline
- SQLite is used only for metadata, not note content
- Never assume network connectivity for core features

### Data Flow Pattern
Always follow this unidirectional flow:
1. User Action → Component Event Handler
2. Component → Zustand Store Action
3. Store → API Layer (api.ts)
4. API → Tauri IPC (invoke)
5. Rust Backend → File System/Database
6. Store State Update → Component Re-render

### Layer Separation
- **Components**: Pure UI, no business logic
- **Stores**: State management and orchestration
- **API Layer**: Tauri IPC calls and database operations
- **Rust Backend**: File operations and system-level logic

## Technology Stack

### Frontend
- React 19 with React Compiler (automatic optimizations)
- TypeScript (strict mode)
- Zustand for state management (NOT Redux)
- Tailwind CSS for styling (utility-first)
- TanStack Query for server state (if needed)
- TanStack Virtual for large lists
- Radix UI for accessible primitives
- Lucide React for icons
- Shadcn for UI library

### Backend
- Rust with Tauri 2
- SQLite via @tauri-apps/plugin-sql
- File system operations via Tauri APIs

## State Management

### Zustand Stores
- All global state lives in Zustand stores in `stores/`
- Each store should have a clear, single responsibility
- Store naming: `*Store.ts` (e.g., `notesStore.ts`)
- Export hook: `use*Store` (e.g., `useNotesStore`)

### Store Structure
```typescript
interface StoreState {
  // State properties
  data: DataType[]
  isLoading: boolean
  
  // Actions
  loadData: () => Promise<void>
  updateData: (id: string) => Promise<void>
}

export const useStore = create<StoreState>((set, get) => ({
  // Initial state
  data: [],
  isLoading: false,
  
  // Actions
  loadData: async () => {
    set({ isLoading: true })
    const data = await api.loadData()
    set({ data, isLoading: false })
  }
}))
```

### Store Guidelines
- Never mutate state directly - always use `set()`
- Async actions should handle loading/error states
- Keep stores focused - one store per domain (vault, notes, sync, etc.)
- Use `get()` for accessing current state within actions

## Component Patterns

### Component Structure
```typescript
// Component file: components/FeatureName.tsx
import { useStore } from '../stores'

interface FeatureNameProps {
  // Props
}

export function FeatureName({ ...props }: FeatureNameProps) {
  const { data, loadData } = useStore()
  
  // Effects, handlers, etc.
  
  return (
    // JSX
  )
}
```

### Component Guidelines
- Use functional components with hooks
- Extract reusable logic to custom hooks in `hooks/`
- Keep components small and focused
- Use TypeScript interfaces for props
- Prefer composition over inheritance
- Use Tailwind classes, avoid inline styles
- Use Lucide React icons (not other icon libraries)

### Component Organization
- Feature components: `components/feature-name/`
- Reusable UI: `components/ui/`
- Dashboard widgets: `components/dashboard/`
- Modals: `components/modals/`
- Sync components: `components/sync/`

## React Patterns

### useEffect Guidelines
- Minimize `useEffect` and prefer pure render logic and event handlers whenever possible
- Do NOT introduce `useEffect` to derive state from props or state. Compute derived values directly during render instead (for example, `const fullName = firstName + ' ' + lastName;`, `const visibleTodos = getFilteredTodos(todos, filter)`)
- If a derived computation is expensive, wrap it in `useMemo` with correct dependencies instead of storing it in state or recalculating via `useEffect`
- Do NOT use `useEffect` for handling user interactions (click, submit, keypress, etc.). Put all event-specific side effects (POST requests, navigation, notifications) directly in event handlers or in functions they call
- When all state in a subtree should reset on a prop change (for example, `userId`), render a keyed child (e.g. `<Profile key={userId} userId={userId} />`) so React remounts and resets its internal state instead of using an effect to reset state
- Avoid `useEffect` whose only purpose is to adjust local state when props change. Prefer reshaping state (for example, store `selectedId` instead of a selected item object) so render logic naturally reflects the latest props
- If you absolutely must adjust local state based on prop changes, do it during render in the same component, guarded by a comparison with previous props (for example, `if (items !== prevItems) { ... }`). Only update that component's own state during render; never update other components' state during render
- Avoid chains of `useEffect` that each update state based on other state (for example, `card → goldCardCount → round → isGameOver`). Instead, compute derived booleans during render and perform all related state updates together in the triggering event handler
- For app-wide initialization that must run once per app load (not per component mount), use module-level code or a module-level `didInit` flag, not a mount-only `useEffect` (which can run twice in development)
- For child-to-parent notifications (such as `onChange`, `onToggle`), call the parent callback directly from the same event handler that updates local state, or lift the state up so the parent owns it. Do NOT use an effect that calls the parent callback when local state changes
- Keep data flow top-down: parents own and fetch data, children receive it via props. Avoid patterns where a child fetches data and then pushes it to the parent via an effect
- When subscribing to external mutable sources (browser APIs, third‑party stores, etc.), prefer a custom hook that uses `useSyncExternalStore` over manual `useEffect` + `useState` subscription logic
- Use `useEffect` for data fetching only when synchronizing remote data with visible parameters (like `query` and `page`). Always handle race conditions by cancelling or ignoring stale requests in the effect's cleanup
- Whenever you need `useEffect`, prefer to wrap it in a focused custom hook with a declarative API (for example, `useData`, `useOnlineStatus`) so most components contain no raw `useEffect` calls
- Before adding `useEffect`, always ask:
  1. Can this be calculated during render?
  2. Can this be done inside an event handler?
  3. Can I reset state via a key or better state shape?
  Only use `useEffect` when synchronizing with external systems or logic that must run because the component is visible

### Hooks Usage
- Prefer custom hooks for reusable logic
- Extract complex useEffect logic to hooks
- Use React Compiler optimizations (automatic)
- Follow React 19 patterns

### Effect Guidelines
- Minimize useEffect usage (see React rules)
- Prefer derived state over effects
- Use effects only for side effects (file watching, subscriptions)
- Clean up subscriptions in effect cleanup

### State Updates
- Use Zustand for global state
- Use useState for local component state
- Use useMemo for expensive computations
- Use useCallback for stable function references

## API Layer Patterns

### Tauri IPC Calls
All backend communication goes through `api.ts`:
```typescript
// In api.ts
export async function createNote(
  vaultPath: string,
  notebookPath: string,
  content: string
): Promise<Note> {
  const result = await invoke<RawNote>('create_note', {
    vaultPath,
    notebookPath,
    content
  })
  
  // Transform and return
  return transformNote(result)
}
```

### API Guidelines
- All Tauri IPC calls must go through `api.ts`
- Never call `invoke()` directly from components or stores
- Transform Rust types to TypeScript types in API layer
- Handle errors at API layer, throw typed errors
- Extract tags/URLs from note content in API layer

## Data Storage

### File System
- Notes: `.md` files in `vault/notebooks/NotebookName/`
- Images: `vault/notebooks/NotebookName/media/`
- Never hardcode paths - use vault path from store
- Always use relative paths within vault

### SQLite Database
- Database: `echopad.db` in app data directory
- Use `@tauri-apps/plugin-sql` for database access
- Always use parameterized queries (prevent SQL injection)
- Tables: settings, pinned_notebooks, note_tags, favorite_notes, og_cache, etc.
- See `docs/ARCHITECTURE.md` for full schema

### Database Guidelines
- Use `getDb()` helper from `api.ts` for database access
- Wrap database operations in try/catch
- Use transactions for multi-step operations
- Index frequently queried columns (tags, etc.)

## Routing & Navigation

### Router Store
- Use `routerStore` for navigation
- Routes: `dashboard`, `notebook`, `search`, `empty`
- Never use React Router - use custom router store
- Navigation triggers component changes in `MainContent`

### Route Structure
```typescript
type Route = 
  | { type: 'dashboard' }
  | { type: 'notebook'; notebookPath: string }
  | { type: 'search'; query?: string }
  | { type: 'empty' }
```

## Styling Guidelines

### Tailwind CSS
- Use Tailwind utility classes exclusively
- Use design tokens from `index.css` (--accent-color, etc.)
- Use `clsx` for conditional classes
- Use `tailwind-merge` when combining classes dynamically
- Follow existing spacing/color patterns

### Design Tokens
- Colors: Use CSS variables (--accent-color, --textMain, --background, etc.)
- Spacing: Use Tailwind spacing scale
- Typography: Use Tailwind font utilities
- Borders: Use `border-border/50` pattern

### shadcn/ui Components
- Use the latest version of Shadcn to install new components
- Example command: `pnpx shadcn@latest add button`
- Keep design tokens configured in the project
- Break components into files when reusing them (only when it makes sense)
- Keep implementations faithful to the Figma design or screenshots
- Don't hardcode CSS values and use project tokens when possible

## Error Handling

### Error Patterns
- Handle errors at appropriate layer:
  - API layer: Catch Tauri errors, throw typed errors
  - Store layer: Catch API errors, set error state
  - Component layer: Display error messages
- Use try/catch for async operations
- Log errors with context (console.error)
- Show user-friendly error messages

## Performance Considerations

### Virtual Scrolling
- Use `@tanstack/react-virtual` for large lists (notes, search results)
- Always virtualize lists with 100+ items
- See `MessageList.tsx` for example

### Pagination
- Load notes in pages of 100
- Use `loadMoreNotes()` pattern for infinite scroll
- Store metadata separately from full note content

### Caching
- Cache OpenGraph metadata for 7 days
- Cache tag index in SQLite
- Use React Query for server state caching (if needed)

## Security Guidelines

### Input Validation
- Sanitize file paths (prevent directory traversal)
- Use parameterized SQL queries (prevent injection)
- Validate user input before processing
- Escape user content in markdown rendering

### Sync Security
- Never log sensitive data (passwords, keys)
- Use encryption for sync (XChaCha20-Poly1305)
- Store credentials securely (use Tauri secure storage)
- Follow zero-knowledge principles for sync

## File Structure Conventions

### Frontend Structure
```
components/
  feature-name/     # Feature-specific components
    Component.tsx
    index.ts
  ui/               # Reusable UI primitives
stores/             # Zustand stores
hooks/              # Custom React hooks
utils/              # Utility functions
types.ts            # TypeScript types
api.ts              # API layer
```

### Naming Conventions
- Components: PascalCase (`MessageList.tsx`)
- Stores: camelCase (`notesStore.ts`)
- Hooks: camelCase with `use` prefix (`useKeyboardShortcuts.ts`)
- Utilities: camelCase (`formatting.ts`)
- Types: PascalCase interfaces/types

## Tauri Patterns

### IPC Commands
- Define commands in Rust (`src-tauri/src/lib.rs` or modules)
- Use typed interfaces for command parameters
- Return typed results from commands
- Handle errors in Rust, return Result types

### File Operations
- Use Tauri file system APIs
- Never use Node.js fs module
- Use async/await for file operations
- Handle file system errors gracefully

## Code Quality

### TypeScript
- Use strict TypeScript
- Define interfaces for all data structures
- Avoid `any` type
- Use type assertions sparingly
- Export types from `types.ts`

### Code Style
- Use 2 spaces for indentation
- Use semicolons
- Use single quotes for strings (or double, be consistent)
- Use trailing commas in objects/arrays
- Keep functions small and focused
- Don't add unnecessary comments for self-explanatory code
- If comments are needed for better performance, add them but remove them later
- Don't write comments in the code

### Comments
- Write self-documenting code
- Add comments for complex logic
- Document public APIs
- Keep comments up-to-date

## Sync Architecture

### Sync Patterns
- Sync is optional - never require it
- Use `syncStore` for sync state
- Sync operations go through Rust backend
- Handle sync errors gracefully
- Show sync status in UI

### Sync Guidelines
- Never sync sensitive data without encryption
- Use zero-knowledge architecture
- Handle conflicts with user resolution
- Background sync should not block UI

## Common Patterns

### Note Operations
```typescript
// Creating a note
const note = await notesStore.createNote(vaultPath, notebookPath, content)

// Updating a note
const updated = await notesStore.updateNote(vaultPath, notebookPath, filename, content)

// Deleting a note
await notesStore.deleteNote(vaultPath, notebookPath, filename)
```

### Notebook Operations
```typescript
// Creating a notebook
const notebook = await notebookStore.createNotebook(vaultPath, name, parentPath)

// Selecting a notebook
notebookStore.selectNotebook(notebookPath)

// Loading notes for notebook
await notesStore.loadNotes(vaultPath, notebookPath)
```

### Search Patterns
```typescript
// Setting search query
searchStore.setQuery(query)

// Applying filters
searchStore.setFilters({ tags: ['tag1'], dateRange: { from, to } })

// Performing search
await searchStore.performSearch(vaultPath)
```

## Migration & Breaking Changes

### Database Migrations
- Add migration logic in `getDb()` function
- Use `ALTER TABLE` with `.catch()` for idempotent migrations
- Document schema changes in `docs/ARCHITECTURE.md`

### API Changes
- Maintain backward compatibility when possible
- Version API changes if breaking
- Update types in `types.ts`
- Update stores if API changes

## When Adding Features

### Checklist
1. ✅ Define types in `types.ts`
2. ✅ Add API functions in `api.ts` (if backend needed)
3. ✅ Create/update Zustand store
4. ✅ Create React components
5. ✅ Add routing (if new route needed)
6. ✅ Update documentation
7. ✅ Test manually
8. ✅ Handle errors gracefully

### Feature Patterns
- **New Note Type**: Add to types, update API, update stores
- **New UI Component**: Create in appropriate `components/` folder
- **New Store**: Create in `stores/`, export from `stores/index.ts`
- **New Hook**: Create in `hooks/`, export from `hooks/index.ts`
- **New Tauri Command**: Add to Rust backend, expose via IPC

## Anti-Patterns to Avoid

❌ Don't call `invoke()` directly from components
❌ Don't mutate Zustand state directly
❌ Don't use React Router
❌ Don't store note content in SQLite
❌ Don't assume network connectivity
❌ Don't use inline styles
❌ Don't use class components
❌ Don't use Redux (use Zustand)
❌ Don't hardcode file paths
❌ Don't skip error handling

## Quick Reference

### Import Patterns
```typescript
// Stores
import { useNotesStore, useVaultStore } from '../stores'

// API
import { createNote, listNotes } from '../api'

// Types
import { Note, Notebook } from '../types'

// Components
import { Button } from '@/components/ui/button'

// Icons
import { Plus, Trash } from 'lucide-react'
```

### Common Utilities
```typescript
// Formatting
import { extractTags, extractUrls } from '../utils/formatting'

// Search
import { searchNotes } from '../utils/search'

// Styling
import { clsx } from 'clsx'
```

## AI Assistant Guidelines

### Minimal and Focused Changes
- Only make changes that are directly requested in the user's query
- Keep solutions simple, concise, and free of extra files, abstractions, or features unless explicitly asked
- Do not overengineer—aim for the most straightforward implementation that achieves the goal

### File Inspection First
- ALWAYS read and understand relevant files in the codebase before proposing any edits or solutions
- Do not speculate about code you have not inspected
- If needed, reference specific file contents in reasoning

### Tool Usage
- Use tools only when directly relevant and necessary
- Avoid overtriggering—phrases like "You MUST use this tool" are not needed; instead, use it if it fits the task naturally

### Output Style
- Be straightforward and sharp in explanations
- Do not add comments to the code unless requested (code should be self-descriptive)
- Avoid emojis, unnecessary verbosity, or side effects
- Prioritize token efficiency in responses

### Project Assumptions
- Don't run the project, assume it's already running
- Properly type the code
- Keep implementations faithful to the Figma design or screenshots when provided

## Documentation

### Code Documentation
- Document complex functions
- Add JSDoc comments for public APIs
- Keep README updated
- Update architecture docs when patterns change

### Architecture Docs
- `docs/PRODUCT_OVERVIEW.md` - Feature list
- `docs/ARCHITECTURE.md` - Technical architecture
- `docs/PROJECT_ARCHITECTURE.md` - System architecture
- `docs/sync/ARCHITECTURE.md` - Sync architecture

## Questions?

Refer to:
- `docs/ARCHITECTURE.md` for technical details
- `docs/PROJECT_ARCHITECTURE.md` for system design
- `docs/PRODUCT_OVERVIEW.md` for feature list
- Existing code for patterns and examples

