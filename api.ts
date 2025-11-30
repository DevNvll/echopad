import { invoke } from '@tauri-apps/api/core'
import { appDataDir, join } from '@tauri-apps/api/path'
import Database from '@tauri-apps/plugin-sql'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { Note, NoteMetadata, Notebook, AppSettings, OgMetadata } from './types'
import { extractTags, extractUrls } from './utils/formatting'

const DEFAULT_APP_SETTINGS: AppSettings = {
  appName: 'Echopad',
  accentColor: '#818cf8'
}

export const DEFAULT_METADATA_PROXY_URL = 'https://metadata.echopad.0x48.dev/'

let db: Database | null = null

async function getDb(): Promise<Database> {
  if (!db) {
    // Use explicit app data directory path to ensure database persists across updates
    const dataDir = await appDataDir()
    const dbPath = await join(dataDir, 'echopad.db')
    db = await Database.load(`sqlite:${dbPath}`)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS pinned_notebooks (
        name TEXT PRIMARY KEY
      )
    `)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS note_tags (
        tag TEXT,
        filename TEXT,
        notebook_path TEXT,
        PRIMARY KEY (tag, filename, notebook_path)
      )
    `)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS known_vaults (
        path TEXT PRIMARY KEY,
        name TEXT,
        added_at INTEGER
      )
    `)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS vault_settings (
        vault_path TEXT PRIMARY KEY,
        accent_color TEXT,
        icon TEXT
      )
    `)
    await db
      .execute(
        `
      ALTER TABLE vault_settings ADD COLUMN icon TEXT
    `
      )
      .catch(() => {})
    await db.execute(
      `CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag)`
    )
    await db.execute(`
      CREATE TABLE IF NOT EXISTS favorite_notes (
        filename TEXT,
        notebook_path TEXT,
        favorited_at INTEGER,
        PRIMARY KEY (filename, notebook_path)
      )
    `)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS og_cache (
        url TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        image TEXT,
        site_name TEXT,
        favicon TEXT,
        cached_at INTEGER
      )
    `)
  }
  return db
}

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const database = await getDb()
  const result = await database.select<{ value: string }[]>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  )
  if (result.length > 0) {
    try {
      return JSON.parse(result[0].value) as T
    } catch {
      return defaultValue
    }
  }
  return defaultValue
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const database = await getDb()
  await database.execute(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, JSON.stringify(value)]
  )
}

export async function getVaultPath(): Promise<string | null> {
  return getSetting<string | null>('vaultPath', null)
}

export async function setVaultPath(path: string): Promise<void> {
  await saveSetting('vaultPath', path)
  await addKnownVault(path)
}

export interface KnownVault {
  path: string
  name: string
  addedAt: number
}

export async function getKnownVaults(): Promise<KnownVault[]> {
  const database = await getDb()
  const result = await database.select<
    { path: string; name: string; added_at: number }[]
  >('SELECT path, name, added_at FROM known_vaults ORDER BY added_at DESC')
  return result.map((r) => ({
    path: r.path,
    name: r.name,
    addedAt: r.added_at
  }))
}

export async function addKnownVault(path: string): Promise<void> {
  const database = await getDb()
  const name = path.split(/[/\\]/).pop() || 'Unknown'
  await database.execute(
    'INSERT OR IGNORE INTO known_vaults (path, name, added_at) VALUES (?, ?, ?)',
    [path, name, Date.now()]
  )
}

export async function removeKnownVault(path: string): Promise<void> {
  const database = await getDb()
  await database.execute('DELETE FROM known_vaults WHERE path = ?', [path])
}

export async function getVaultAccentColor(
  vaultPath: string
): Promise<string | null> {
  const database = await getDb()
  const result = await database.select<{ accent_color: string }[]>(
    'SELECT accent_color FROM vault_settings WHERE vault_path = ?',
    [vaultPath]
  )
  return result.length > 0 ? result[0].accent_color : null
}

export async function saveVaultAccentColor(
  vaultPath: string,
  accentColor: string
): Promise<void> {
  const database = await getDb()
  await database.execute(
    'INSERT INTO vault_settings (vault_path, accent_color) VALUES (?, ?) ON CONFLICT(vault_path) DO UPDATE SET accent_color = ?',
    [vaultPath, accentColor, accentColor]
  )
}

export async function getVaultIcon(vaultPath: string): Promise<string | null> {
  const database = await getDb()
  const result = await database.select<{ icon: string | null }[]>(
    'SELECT icon FROM vault_settings WHERE vault_path = ?',
    [vaultPath]
  )
  return result.length > 0 ? result[0].icon : null
}

export async function saveVaultIcon(
  vaultPath: string,
  icon: string
): Promise<void> {
  const database = await getDb()
  await database.execute(
    'INSERT INTO vault_settings (vault_path, icon) VALUES (?, ?) ON CONFLICT(vault_path) DO UPDATE SET icon = ?',
    [vaultPath, icon, icon]
  )
}

export async function applyAccentColorToAllVaults(
  accentColor: string
): Promise<void> {
  const database = await getDb()
  const vaults = await getKnownVaults()
  for (const vault of vaults) {
    await database.execute(
      'INSERT INTO vault_settings (vault_path, accent_color) VALUES (?, ?) ON CONFLICT(vault_path) DO UPDATE SET accent_color = ?',
      [vault.path, accentColor, accentColor]
    )
  }
}

interface RawNotebook {
  name: string
  path: string
  relative_path: string
  children?: RawNotebook[]
}

function mapNotebook(raw: RawNotebook, pinnedSet: Set<string>): Notebook {
  return {
    name: raw.name,
    path: raw.path,
    relativePath: raw.relative_path,
    isPinned: pinnedSet.has(raw.relative_path),
    children: raw.children?.map((c) => mapNotebook(c, pinnedSet))
  }
}

export async function listNotebooks(vaultPath: string): Promise<Notebook[]> {
  const notebooks = await invoke<RawNotebook[]>('list_notebooks', { vaultPath })
  const database = await getDb()
  const pinnedResult = await database.select<{ name: string }[]>(
    'SELECT name FROM pinned_notebooks'
  )
  const pinnedSet = new Set(pinnedResult.map((r) => r.name))

  return notebooks.map((n) => mapNotebook(n, pinnedSet))
}

export async function createNotebook(
  vaultPath: string,
  name: string,
  parentPath?: string
): Promise<Notebook> {
  const raw = await invoke<RawNotebook>('create_notebook', {
    vaultPath,
    name,
    parentPath: parentPath || null
  })
  return {
    name: raw.name,
    path: raw.path,
    relativePath: raw.relative_path,
    children: undefined
  }
}

export async function renameNotebook(
  vaultPath: string,
  oldRelativePath: string,
  newName: string
): Promise<Notebook> {
  const database = await getDb()
  const wasPinned = await database.select<{ name: string }[]>(
    'SELECT name FROM pinned_notebooks WHERE name = ?',
    [oldRelativePath]
  )

  const raw = await invoke<RawNotebook>('rename_notebook', {
    vaultPath,
    oldRelativePath,
    newName
  })

  if (wasPinned.length > 0) {
    await database.execute('DELETE FROM pinned_notebooks WHERE name = ?', [
      oldRelativePath
    ])
    await database.execute('INSERT INTO pinned_notebooks (name) VALUES (?)', [
      raw.relative_path
    ])
  }

  return {
    name: raw.name,
    path: raw.path,
    relativePath: raw.relative_path,
    children: undefined
  }
}

export async function deleteNotebook(
  vaultPath: string,
  relativePath: string
): Promise<void> {
  await invoke('delete_notebook', { vaultPath, relativePath })
  const database = await getDb()
  await database.execute('DELETE FROM pinned_notebooks WHERE name = ?', [
    relativePath
  ])
}

export async function toggleNotebookPin(
  relativePath: string
): Promise<boolean> {
  const database = await getDb()
  const existing = await database.select<{ name: string }[]>(
    'SELECT name FROM pinned_notebooks WHERE name = ?',
    [relativePath]
  )

  if (existing.length > 0) {
    await database.execute('DELETE FROM pinned_notebooks WHERE name = ?', [
      relativePath
    ])
    return false
  } else {
    await database.execute('INSERT INTO pinned_notebooks (name) VALUES (?)', [
      relativePath
    ])
    return true
  }
}

export async function listNotes(
  vaultPath: string,
  notebookPath: string
): Promise<NoteMetadata[]> {
  return invoke<NoteMetadata[]>('list_notes', { vaultPath, notebookPath })
}

export async function readNote(
  vaultPath: string,
  notebookPath: string,
  filename: string
): Promise<Note> {
  const result = await invoke<{
    filename: string
    content: string
    created_at: number
  }>('read_note', {
    vaultPath,
    notebookPath,
    filename
  })

  const tags = extractTags(result.content)
  const urls = extractUrls(result.content)

  return {
    filename: result.filename,
    content: result.content,
    createdAt: result.created_at,
    tags,
    hasLink: urls.length > 0,
    urls,
    notebookName: notebookPath
  }
}

export async function createNote(
  vaultPath: string,
  notebookPath: string,
  content: string
): Promise<Note> {
  const result = await invoke<{
    filename: string
    content: string
    created_at: number
  }>('create_note', {
    vaultPath,
    notebookPath,
    content
  })

  const tags = extractTags(result.content)
  const urls = extractUrls(result.content)

  return {
    filename: result.filename,
    content: result.content,
    createdAt: result.created_at,
    tags,
    hasLink: urls.length > 0,
    urls,
    notebookName: notebookPath
  }
}

export async function updateNote(
  vaultPath: string,
  notebookPath: string,
  filename: string,
  content: string
): Promise<Note> {
  const result = await invoke<{
    filename: string
    content: string
    created_at: number
  }>('update_note', {
    vaultPath,
    notebookPath,
    filename,
    content
  })

  const tags = extractTags(result.content)
  const urls = extractUrls(result.content)

  return {
    filename: result.filename,
    content: result.content,
    createdAt: result.created_at,
    tags,
    hasLink: urls.length > 0,
    urls,
    notebookName: notebookPath
  }
}

export async function deleteNote(
  vaultPath: string,
  notebookPath: string,
  filename: string
): Promise<void> {
  await invoke('delete_note', { vaultPath, notebookPath, filename })
}

function flattenNotebooks(notebooks: Notebook[]): Notebook[] {
  const result: Notebook[] = []
  for (const nb of notebooks) {
    result.push(nb)
    if (nb.children) {
      result.push(...flattenNotebooks(nb.children))
    }
  }
  return result
}

export async function searchNotes(
  vaultPath: string,
  query: string
): Promise<Note[]> {
  const notebooks = await listNotebooks(vaultPath)
  const flatNotebooks = flattenNotebooks(notebooks)
  const allNotes: Note[] = []
  const lowerQuery = query.toLowerCase()

  for (const notebook of flatNotebooks) {
    const noteMetadata = await listNotes(vaultPath, notebook.relativePath)
    for (const meta of noteMetadata) {
      const note = await readNote(
        vaultPath,
        notebook.relativePath,
        meta.filename
      )
      if (
        note.content.toLowerCase().includes(lowerQuery) ||
        note.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
      ) {
        allNotes.push(note)
      }
    }
  }

  return allNotes.sort((a, b) => b.createdAt - a.createdAt)
}

export async function saveImage(
  vaultPath: string,
  imageData: string,
  extension: string
): Promise<string> {
  return invoke<string>('save_image', {
    vaultPath,
    imageData,
    extension
  })
}

export async function getTotalNotesCount(vaultPath: string): Promise<number> {
  const notebooks = await listNotebooks(vaultPath)
  const flatNotebooks = flattenNotebooks(notebooks)
  let count = 0

  for (const notebook of flatNotebooks) {
    const noteMetadata = await listNotes(vaultPath, notebook.relativePath)
    count += noteMetadata.length
  }

  return count
}

export async function getRecentNotes(
  vaultPath: string,
  limit: number = 5
): Promise<Note[]> {
  const notebooks = await listNotebooks(vaultPath)
  const flatNotebooks = flattenNotebooks(notebooks)
  const allNotes: Note[] = []

  for (const notebook of flatNotebooks) {
    const noteMetadata = await listNotes(vaultPath, notebook.relativePath)
    for (const meta of noteMetadata) {
      const note = await readNote(
        vaultPath,
        notebook.relativePath,
        meta.filename
      )
      allNotes.push(note)
    }
  }

  return allNotes.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit)
}

export interface TagWithCount {
  tag: string
  count: number
}

export async function syncVaultTags(vaultPath: string): Promise<void> {
  const database = await getDb()
  await database.execute('DELETE FROM note_tags')

  const notebooks = await listNotebooks(vaultPath)
  const flatNotebooks = flattenNotebooks(notebooks)

  for (const notebook of flatNotebooks) {
    const noteMetadata = await listNotes(vaultPath, notebook.relativePath)
    for (const meta of noteMetadata) {
      const note = await readNote(
        vaultPath,
        notebook.relativePath,
        meta.filename
      )
      for (const tag of note.tags) {
        await database.execute(
          'INSERT OR IGNORE INTO note_tags (tag, filename, notebook_path) VALUES (?, ?, ?)',
          [tag, note.filename, notebook.relativePath]
        )
      }
    }
  }
}

export async function syncNoteTags(note: Note): Promise<void> {
  const database = await getDb()
  await database.execute(
    'DELETE FROM note_tags WHERE filename = ? AND notebook_path = ?',
    [note.filename, note.notebookName]
  )

  for (const tag of note.tags) {
    await database.execute(
      'INSERT OR IGNORE INTO note_tags (tag, filename, notebook_path) VALUES (?, ?, ?)',
      [tag, note.filename, note.notebookName]
    )
  }
}

export async function removeNoteTags(
  filename: string,
  notebookPath: string
): Promise<void> {
  const database = await getDb()
  await database.execute(
    'DELETE FROM note_tags WHERE filename = ? AND notebook_path = ?',
    [filename, notebookPath]
  )
}

export async function getAllTags(): Promise<TagWithCount[]> {
  const database = await getDb()
  const result = await database.select<{ tag: string; count: number }[]>(
    'SELECT tag, COUNT(*) as count FROM note_tags GROUP BY tag ORDER BY count DESC'
  )
  return result
}

export async function searchByTag(
  vaultPath: string,
  tag: string
): Promise<Note[]> {
  const database = await getDb()
  const result = await database.select<
    { filename: string; notebook_path: string }[]
  >('SELECT DISTINCT filename, notebook_path FROM note_tags WHERE tag = ?', [
    tag.toLowerCase()
  ])

  const notes: Note[] = []
  for (const row of result) {
    const note = await readNote(vaultPath, row.notebook_path, row.filename)
    notes.push(note)
  }

  return notes.sort((a, b) => b.createdAt - a.createdAt)
}

export async function getAppSettings(): Promise<AppSettings> {
  const appName = await getSetting<string>(
    'appName',
    DEFAULT_APP_SETTINGS.appName
  )
  const accentColor = await getSetting<string>(
    'accentColor',
    DEFAULT_APP_SETTINGS.accentColor
  )
  return { appName, accentColor }
}

export async function saveAppSettings(
  settings: Partial<AppSettings>
): Promise<void> {
  if (settings.appName !== undefined) {
    await saveSetting('appName', settings.appName)
  }
  if (settings.accentColor !== undefined) {
    await saveSetting('accentColor', settings.accentColor)
  }
}

export async function openNotebookInExplorer(
  notebookPath: string
): Promise<void> {
  await revealItemInDir(notebookPath)
}

export async function getQuickCaptureNotebook(): Promise<string | null> {
  return getSetting<string | null>('quickCaptureNotebook', null)
}

export async function setQuickCaptureNotebook(
  notebookPath: string
): Promise<void> {
  await saveSetting('quickCaptureNotebook', notebookPath)
}

export async function getMetadataProxyUrl(): Promise<string> {
  return getSetting<string>('metadataProxyUrl', DEFAULT_METADATA_PROXY_URL)
}

export async function setMetadataProxyUrl(url: string): Promise<void> {
  await saveSetting('metadataProxyUrl', url)
}

// Favorite notes functions
export async function isNoteFavorite(
  filename: string,
  notebookPath: string
): Promise<boolean> {
  const database = await getDb()
  const result = await database.select<{ filename: string }[]>(
    'SELECT filename FROM favorite_notes WHERE filename = ? AND notebook_path = ?',
    [filename, notebookPath]
  )
  return result.length > 0
}

export async function toggleNoteFavorite(
  filename: string,
  notebookPath: string
): Promise<boolean> {
  const database = await getDb()
  const existing = await database.select<{ filename: string }[]>(
    'SELECT filename FROM favorite_notes WHERE filename = ? AND notebook_path = ?',
    [filename, notebookPath]
  )

  if (existing.length > 0) {
    await database.execute(
      'DELETE FROM favorite_notes WHERE filename = ? AND notebook_path = ?',
      [filename, notebookPath]
    )
    return false
  } else {
    await database.execute(
      'INSERT INTO favorite_notes (filename, notebook_path, favorited_at) VALUES (?, ?, ?)',
      [filename, notebookPath, Date.now()]
    )
    return true
  }
}

export async function getFavoriteNotes(vaultPath: string): Promise<Note[]> {
  const database = await getDb()
  const result = await database.select<
    { filename: string; notebook_path: string; favorited_at: number }[]
  >(
    'SELECT filename, notebook_path, favorited_at FROM favorite_notes ORDER BY favorited_at DESC'
  )

  const notes: Note[] = []
  for (const row of result) {
    try {
      const note = await readNote(vaultPath, row.notebook_path, row.filename)
      note.isFavorite = true
      notes.push(note)
    } catch {
      // Note might have been deleted, remove from favorites
      await database.execute(
        'DELETE FROM favorite_notes WHERE filename = ? AND notebook_path = ?',
        [row.filename, row.notebook_path]
      )
    }
  }

  return notes
}

export async function removeNoteFavorite(
  filename: string,
  notebookPath: string
): Promise<void> {
  const database = await getDb()
  await database.execute(
    'DELETE FROM favorite_notes WHERE filename = ? AND notebook_path = ?',
    [filename, notebookPath]
  )
}

// Get all notes from a specific notebook (unpaginated, for media extraction)
export async function getAllNotesFromNotebook(
  vaultPath: string,
  notebookPath: string
): Promise<Note[]> {
  const noteMetadata = await listNotes(vaultPath, notebookPath)
  const notes: Note[] = []

  for (const meta of noteMetadata) {
    const note = await readNote(vaultPath, notebookPath, meta.filename)
    notes.push(note)
  }

  return notes.sort((a, b) => b.createdAt - a.createdAt)
}

// OG Metadata cache duration (7 days in milliseconds)
const OG_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000

interface RawOgMetadata {
  url: string
  title: string | null
  description: string | null
  image: string | null
  site_name: string | null
  favicon: string | null
}

interface CachedOgRow {
  url: string
  title: string | null
  description: string | null
  image: string | null
  site_name: string | null
  favicon: string | null
  cached_at: number
}

async function getCachedOgMetadata(url: string): Promise<OgMetadata | null> {
  const database = await getDb()
  const result = await database.select<CachedOgRow[]>(
    'SELECT * FROM og_cache WHERE url = ?',
    [url]
  )

  if (result.length === 0) {
    return null
  }

  const row = result[0]
  const isExpired = Date.now() - row.cached_at > OG_CACHE_DURATION

  if (isExpired) {
    return null
  }

  return {
    url: row.url,
    title: row.title,
    description: row.description,
    image: row.image,
    siteName: row.site_name,
    favicon: row.favicon,
    cachedAt: row.cached_at
  }
}

async function saveOgMetadataToCache(metadata: OgMetadata): Promise<void> {
  const database = await getDb()
  await database.execute(
    `INSERT OR REPLACE INTO og_cache (url, title, description, image, site_name, favicon, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      metadata.url,
      metadata.title,
      metadata.description,
      metadata.image,
      metadata.siteName,
      metadata.favicon,
      Date.now()
    ]
  )
}

interface ProxyOgResponse {
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  favicon: string | null
}

export async function fetchOgMetadata(url: string): Promise<OgMetadata> {
  // Check cache first
  const cached = await getCachedOgMetadata(url)
  if (cached) {
    return cached
  }

  // Fetch from metadata proxy
  try {
    const proxyUrl = await getMetadataProxyUrl()
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    })

    if (!response.ok) {
      throw new Error(`Proxy returned ${response.status}`)
    }

    const data = (await response.json()) as ProxyOgResponse

    const metadata: OgMetadata = {
      url,
      title: data.title,
      description: data.description,
      image: data.image,
      siteName: data.siteName,
      favicon: data.favicon
    }

    // Save to cache
    await saveOgMetadataToCache(metadata)

    return metadata
  } catch (error) {
    // Return minimal metadata on error
    return {
      url,
      title: null,
      description: null,
      image: null,
      siteName: null,
      favicon: null
    }
  }
}

export async function clearOgCache(): Promise<void> {
  const database = await getDb()
  await database.execute('DELETE FROM og_cache')
}
