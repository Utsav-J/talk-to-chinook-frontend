import type { Message } from '../types/api';

/**
 * Generate a thread title from the first user message
 * Converts to title case
 */
export function generateThreadTitle(messages: Message[]): string | null {
  // Get the first user message
  const firstUserMessage = messages.find(
    msg => msg.role === 'user' && msg.content && msg.content.trim().length > 0
  );

  if (!firstUserMessage) {
    return null;
  }

  // Extract content and clean it
  let text = firstUserMessage.content.trim();
  // Truncate if too long (max 80 chars for single message title)
  if (text.length > 80) {
    text = text.substring(0, 77) + '...';
  }
  
  // Convert to title case and return
  return toTitleCase(text);
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

