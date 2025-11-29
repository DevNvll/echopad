import { useState, useEffect } from 'react';
import { Note } from '../../../types';
import { searchNotes, searchByTag, TagWithCount } from '../../../api';

interface UseCommandSearchProps {
  isOpen: boolean;
  vaultPath: string | null;
  allTags: TagWithCount[];
  initialSearch: string;
}

interface UseCommandSearchReturn {
  search: string;
  setSearch: (value: string) => void;
  results: Note[];
  filteredTags: TagWithCount[];
  isTagSearch: boolean;
}

export const useCommandSearch = ({
  isOpen,
  vaultPath,
  allTags,
  initialSearch,
}: UseCommandSearchProps): UseCommandSearchReturn => {
  const [search, setSearch] = useState(initialSearch);
  const [results, setResults] = useState<Note[]>([]);

  useEffect(() => {
    if (isOpen && initialSearch) {
      setSearch(initialSearch);
    }
  }, [isOpen, initialSearch]);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setResults([]);
    }
  }, [isOpen]);

  const isTagSearch = search.trim().startsWith('#');
  const tagQuery = isTagSearch ? search.trim().slice(1).toLowerCase() : '';

  const filteredTags = isTagSearch && tagQuery
    ? allTags.filter(t => t.tag.toLowerCase().includes(tagQuery))
    : allTags.slice(0, 10);

  useEffect(() => {
    const runSearch = async () => {
      if (!search.trim() || !vaultPath) {
        setResults([]);
        return;
      }

      if (isTagSearch && tagQuery) {
        const exactMatch = allTags.find(t => t.tag.toLowerCase() === tagQuery);
        if (exactMatch) {
          const found = await searchByTag(vaultPath, tagQuery);
          setResults(found.slice(0, 20));
          return;
        }
      }

      const found = await searchNotes(vaultPath, search);
      setResults(found.slice(0, 20));
    };

    const timer = setTimeout(runSearch, 150);
    return () => clearTimeout(timer);
  }, [search, vaultPath, isTagSearch, tagQuery, allTags]);

  return {
    search,
    setSearch,
    results,
    filteredTags,
    isTagSearch,
  };
};

