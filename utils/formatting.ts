import { format, isToday, isYesterday, differenceInMinutes } from 'date-fns';

export const formatMessageDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  if (isToday(date)) {
    return `Today at ${format(date, 'h:mm aa')}`;
  }
  if (isYesterday(date)) {
    return `Yesterday at ${format(date, 'h:mm aa')}`;
  }
  return format(date, 'MM/dd/yyyy');
};

export const shouldGroupMessages = (current: number, previous: number | null): boolean => {
  if (!previous) return false;
  const diff = differenceInMinutes(current, previous);
  return diff < 5; // Group if within 5 minutes
};

// Simple URL extractor
export const extractUrls = (text: string): string[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

// Convert bare URLs in text to markdown links
// Skips URLs that are already in markdown link syntax [text](url) or <url>
export const linkifyUrls = (text: string): string => {
  // Match URLs that are NOT:
  // - Inside markdown link syntax: [text](url)
  // - Inside angle brackets: <url>
  // - Already a markdown link text part
  return text.replace(
    /(?<!\]\()(?<!\<)(https?:\/\/[^\s\)>\]]+)(?!\))/g,
    (match, url) => {
      // Check if this URL is part of a markdown link by looking at context
      const index = text.indexOf(match);
      const before = text.slice(Math.max(0, index - 2), index);
      const after = text.slice(index + match.length, index + match.length + 1);
      
      // Already in markdown link syntax
      if (before.endsWith('](') || before.endsWith('<') || after === ')') {
        return match;
      }
      
      return `[${url}](${url})`;
    }
  );
};

// Extract hashtags
export const extractTags = (text: string): string[] => {
  const tagRegex = /#(\w+)/g;
  const matches = text.match(tagRegex);
  return matches ? matches.map(t => t.slice(1).toLowerCase()) : [];
};
