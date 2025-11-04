import type { Message } from '../types/api';

/**
 * Generate a thread title from the first two user messages
 * Converts to title case and concatenates with " - "
 */
export function generateThreadTitle(messages: Message[]): string | null {
  // Get user messages only
  const userMessages = messages
    .filter(msg => msg.role === 'user' && msg.content && msg.content.trim().length > 0)
    .slice(0, 2); // Take first two

  if (userMessages.length === 0) {
    return null;
  }

  // Extract content and clean it
  const titles = userMessages.map(msg => {
    let text = msg.content.trim();
    // Truncate if too long (max 50 chars per message)
    if (text.length > 50) {
      text = text.substring(0, 47) + '...';
    }
    return toTitleCase(text);
  });

  // Concatenate with " - "
  return titles.join(' - ');
}

/**
 * Convert a string to title case
 * Handles basic title case conversion
 */
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => {
      // Skip empty strings
      if (!word) return word;
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

