export interface Note {
  filename: string;
  content: string;
  createdAt: number;
  tags: string[];
  hasLink: boolean;
  urls: string[];
  notebookName: string;
  isFavorite?: boolean;
}

export interface NoteMetadata {
  filename: string;
  createdAt: number;
}

export interface Notebook {
  name: string;
  path: string;
  relativePath: string;
  isPinned?: boolean;
  children?: Notebook[];
}

export interface SearchFilters {
  query: string;
  until?: Date;
  since?: Date;
  hasLink?: boolean;
  tags: string[];
  textTokens: string[];
  isOrSearch: boolean;
}

export interface AppSettings {
  appName: string;
  accentColor: string;
}

export interface OgMetadata {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
  cachedAt?: number;
}

export interface KanbanCard {
  id: string;
  content: string;
  tags: string[];
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

export interface KanbanBoard {
  filename: string;
  title: string;
  createdAt: number;
  columns: KanbanColumn[];
  isPinned?: boolean;
}

export interface BoardMetadata {
  filename: string;
  createdAt: number;
  title?: string;
}