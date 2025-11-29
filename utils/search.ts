import { SearchFilters } from '../types';
import { startOfDay, endOfDay, parseISO, isValid } from 'date-fns';

/**
 * Parses a search string like "until:2023-01-01 has:link project OR work"
 */
export const parseSearchQuery = (query: string): SearchFilters => {
  const filters: SearchFilters = {
    query,
    tags: [],
    textTokens: [],
    isOrSearch: false,
  };

  const tokens = query.split(/\s+/);
  
  tokens.forEach(token => {
    if (token === 'OR') {
      filters.isOrSearch = true;
      return;
    }

    // Handle hashtags
    if (token.startsWith('#')) {
      const tag = token.slice(1);
      if (tag) filters.tags.push(tag.toLowerCase());
      return;
    }

    // Handle operators
    const colonIndex = token.indexOf(':');
    if (colonIndex > -1) {
      const key = token.slice(0, colonIndex).toLowerCase();
      const value = token.slice(colonIndex + 1);

      switch (key) {
        case 'until':
        case 'before': {
          const date = parseISO(value);
          if (isValid(date)) filters.until = endOfDay(date);
          break;
        }
        case 'since':
        case 'after': {
          const date = parseISO(value);
          if (isValid(date)) filters.since = startOfDay(date);
          break;
        }
        case 'has':
          if (value === 'link') filters.hasLink = true;
          break;
        default:
          // If unknown operator, treat as text
          filters.textTokens.push(token.toLowerCase());
      }
    } else {
      // Regular text
      filters.textTokens.push(token.toLowerCase());
    }
  });

  return filters;
};

export const filterNote = (note: any, filters: SearchFilters): boolean => {
  // 1. Date Filters (Inclusive)
  if (filters.until && note.createdAt > filters.until.getTime()) return false;
  if (filters.since && note.createdAt < filters.since.getTime()) return false;

  // 2. Metadata Filters
  if (filters.hasLink && !note.hasLink) return false;
  
  // 3. Tags (Must contain ALL specified tags)
  if (filters.tags.length > 0) {
    const noteTags = note.tags || [];
    const hasAllTags = filters.tags.every(t => noteTags.includes(t));
    if (!hasAllTags) return false;
  }

  // 4. Text Search
  if (filters.textTokens.length > 0) {
    const content = note.content.toLowerCase();
    
    if (filters.isOrSearch) {
      // OR logic: match any token
      const matchesAny = filters.textTokens.some(token => content.includes(token));
      if (!matchesAny) return false;
    } else {
      // AND logic: match all tokens
      const matchesAll = filters.textTokens.every(token => content.includes(token));
      if (!matchesAll) return false;
    }
  }

  return true;
};
