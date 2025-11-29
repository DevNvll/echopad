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

// Extract hashtags
export const extractTags = (text: string): string[] => {
  const tagRegex = /#(\w+)/g;
  const matches = text.match(tagRegex);
  return matches ? matches.map(t => t.slice(1).toLowerCase()) : [];
};
