export interface Note {
  filename: string;
  content: string;
  createdAt: number;
  tags: string[];
  hasLink: boolean;
  urls: string[];
  notebookName: string;
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