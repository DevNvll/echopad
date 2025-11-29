import { invoke } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';
import { Note, NoteMetadata, Notebook } from './types';
import { extractTags, extractUrls } from './utils/formatting';

let db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:lazuli.db');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS pinned_notebooks (
        name TEXT PRIMARY KEY
      )
    `);
  }
  return db;
}

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const database = await getDb();
  const result = await database.select<{ value: string }[]>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  if (result.length > 0) {
    try {
      return JSON.parse(result[0].value) as T;
    } catch {
      return defaultValue;
    }
  }
  return defaultValue;
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const database = await getDb();
  await database.execute(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, JSON.stringify(value)]
  );
}

export async function getVaultPath(): Promise<string | null> {
  return getSetting<string | null>('vaultPath', null);
}

export async function setVaultPath(path: string): Promise<void> {
  await saveSetting('vaultPath', path);
}

export async function listNotebooks(vaultPath: string): Promise<Notebook[]> {
  const notebooks = await invoke<{ name: string; path: string }[]>('list_notebooks', { vaultPath });
  const database = await getDb();
  const pinnedResult = await database.select<{ name: string }[]>('SELECT name FROM pinned_notebooks');
  const pinnedSet = new Set(pinnedResult.map(r => r.name));
  
  return notebooks.map(n => ({
    ...n,
    isPinned: pinnedSet.has(n.name)
  }));
}

export async function createNotebook(vaultPath: string, name: string): Promise<Notebook> {
  return invoke<Notebook>('create_notebook', { vaultPath, name });
}

export async function renameNotebook(vaultPath: string, oldName: string, newName: string): Promise<Notebook> {
  const database = await getDb();
  const wasPinned = await database.select<{ name: string }[]>(
    'SELECT name FROM pinned_notebooks WHERE name = ?',
    [oldName]
  );
  
  const result = await invoke<Notebook>('rename_notebook', { vaultPath, oldName, newName });
  
  if (wasPinned.length > 0) {
    await database.execute('DELETE FROM pinned_notebooks WHERE name = ?', [oldName]);
    await database.execute('INSERT INTO pinned_notebooks (name) VALUES (?)', [newName]);
  }
  
  return result;
}

export async function deleteNotebook(vaultPath: string, name: string): Promise<void> {
  await invoke('delete_notebook', { vaultPath, name });
  const database = await getDb();
  await database.execute('DELETE FROM pinned_notebooks WHERE name = ?', [name]);
}

export async function toggleNotebookPin(name: string): Promise<boolean> {
  const database = await getDb();
  const existing = await database.select<{ name: string }[]>(
    'SELECT name FROM pinned_notebooks WHERE name = ?',
    [name]
  );
  
  if (existing.length > 0) {
    await database.execute('DELETE FROM pinned_notebooks WHERE name = ?', [name]);
    return false;
  } else {
    await database.execute('INSERT INTO pinned_notebooks (name) VALUES (?)', [name]);
    return true;
  }
}

export async function listNotes(vaultPath: string, notebookName: string): Promise<NoteMetadata[]> {
  return invoke<NoteMetadata[]>('list_notes', { vaultPath, notebookName });
}

export async function readNote(vaultPath: string, notebookName: string, filename: string): Promise<Note> {
  const result = await invoke<{ filename: string; content: string; created_at: number }>('read_note', {
    vaultPath,
    notebookName,
    filename
  });
  
  const tags = extractTags(result.content);
  const urls = extractUrls(result.content);
  
  return {
    filename: result.filename,
    content: result.content,
    createdAt: result.created_at,
    tags,
    hasLink: urls.length > 0,
    urls,
    notebookName
  };
}

export async function createNote(vaultPath: string, notebookName: string, content: string): Promise<Note> {
  const result = await invoke<{ filename: string; content: string; created_at: number }>('create_note', {
    vaultPath,
    notebookName,
    content
  });
  
  const tags = extractTags(result.content);
  const urls = extractUrls(result.content);
  
  return {
    filename: result.filename,
    content: result.content,
    createdAt: result.created_at,
    tags,
    hasLink: urls.length > 0,
    urls,
    notebookName
  };
}

export async function updateNote(vaultPath: string, notebookName: string, filename: string, content: string): Promise<Note> {
  const result = await invoke<{ filename: string; content: string; created_at: number }>('update_note', {
    vaultPath,
    notebookName,
    filename,
    content
  });
  
  const tags = extractTags(result.content);
  const urls = extractUrls(result.content);
  
  return {
    filename: result.filename,
    content: result.content,
    createdAt: result.created_at,
    tags,
    hasLink: urls.length > 0,
    urls,
    notebookName
  };
}

export async function deleteNote(vaultPath: string, notebookName: string, filename: string): Promise<void> {
  await invoke('delete_note', { vaultPath, notebookName, filename });
}

export async function searchNotes(vaultPath: string, query: string): Promise<Note[]> {
  const notebooks = await listNotebooks(vaultPath);
  const allNotes: Note[] = [];
  const lowerQuery = query.toLowerCase();
  
  for (const notebook of notebooks) {
    const noteMetadata = await listNotes(vaultPath, notebook.name);
    for (const meta of noteMetadata) {
      const note = await readNote(vaultPath, notebook.name, meta.filename);
      if (note.content.toLowerCase().includes(lowerQuery) || 
          note.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
        allNotes.push(note);
      }
    }
  }
  
  return allNotes.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveImage(vaultPath: string, notebookName: string, imageData: string, extension: string): Promise<string> {
  return invoke<string>('save_image', {
    vaultPath,
    notebookName,
    imageData,
    extension
  });
}

