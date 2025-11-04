import type { ThreadInfo, Message } from '../types/api';

const STORAGE_KEYS = {
  THREADS: 'chinook_threads',
  MESSAGES: 'chinook_messages_',
  LAST_SYNC: 'chinook_last_sync',
} as const;

interface StoredThread extends ThreadInfo {
  lastSynced?: string;
}

interface StoredMessages {
  messages: Message[];
  lastSynced?: string;
}

class StorageService {
  private isAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  private handleStorageError(error: Error, operation: string) {
    console.warn(`Storage ${operation} failed:`, error);
    // Don't throw - gracefully degrade
  }

  // Thread Management
  saveThreads(threads: ThreadInfo[]): void {
    if (!this.isAvailable()) return;

    try {
      const storedThreads: StoredThread[] = threads.map(thread => ({
        ...thread,
        lastSynced: new Date().toISOString(),
      }));
      localStorage.setItem(STORAGE_KEYS.THREADS, JSON.stringify(storedThreads));
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    } catch (error) {
      this.handleStorageError(error as Error, 'saveThreads');
    }
  }

  getThreads(): ThreadInfo[] {
    if (!this.isAvailable()) return [];

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.THREADS);
      if (!stored) return [];

      const storedThreads: StoredThread[] = JSON.parse(stored);
      return storedThreads.map(({ lastSynced, ...thread }) => thread);
    } catch (error) {
      this.handleStorageError(error as Error, 'getThreads');
      return [];
    }
  }

  addOrUpdateThread(thread: ThreadInfo): void {
    if (!this.isAvailable()) return;

    try {
      const threads = this.getThreads();
      const index = threads.findIndex(t => t.thread_id === thread.thread_id);

      if (index >= 0) {
        threads[index] = thread;
      } else {
        threads.unshift(thread); // Add to beginning
      }

      this.saveThreads(threads);
    } catch (error) {
      this.handleStorageError(error as Error, 'addOrUpdateThread');
    }
  }

  removeThread(threadId: string): void {
    if (!this.isAvailable()) return;

    try {
      const threads = this.getThreads();
      const filtered = threads.filter(t => t.thread_id !== threadId);
      this.saveThreads(filtered);
      
      // Also remove messages for this thread
      this.removeMessages(threadId);
    } catch (error) {
      this.handleStorageError(error as Error, 'removeThread');
    }
  }

  getThread(threadId: string): ThreadInfo | null {
    const threads = this.getThreads();
    return threads.find(t => t.thread_id === threadId) || null;
  }

  // Message Management
  saveMessages(threadId: string, messages: Message[]): void {
    if (!this.isAvailable()) return;

    try {
      const stored: StoredMessages = {
        messages,
        lastSynced: new Date().toISOString(),
      };
      localStorage.setItem(
        `${STORAGE_KEYS.MESSAGES}${threadId}`,
        JSON.stringify(stored)
      );
    } catch (error) {
      this.handleStorageError(error as Error, 'saveMessages');
    }
  }

  getMessages(threadId: string): Message[] {
    if (!this.isAvailable()) return [];

    try {
      const stored = localStorage.getItem(`${STORAGE_KEYS.MESSAGES}${threadId}`);
      if (!stored) return [];

      const data: StoredMessages = JSON.parse(stored);
      return data.messages || [];
    } catch (error) {
      this.handleStorageError(error as Error, 'getMessages');
      return [];
    }
  }

  addMessage(threadId: string, message: Message): void {
    if (!this.isAvailable()) return;

    try {
      const messages = this.getMessages(threadId);
      
      // Check if message already exists (by id or content+timestamp)
      const exists = messages.some(
        m => m.id === message.id || 
        (m.content === message.content && 
         m.timestamp === message.timestamp && 
         m.role === message.role)
      );

      if (!exists) {
        messages.push(message);
        this.saveMessages(threadId, messages);
      }
    } catch (error) {
      this.handleStorageError(error as Error, 'addMessage');
    }
  }

  addMessages(threadId: string, newMessages: Message[]): void {
    if (!this.isAvailable()) return;

    try {
      const existingMessages = this.getMessages(threadId);
      const existingIds = new Set(existingMessages.map(m => m.id).filter(Boolean));
      
      // Merge messages, avoiding duplicates
      const merged = [...existingMessages];
      
      newMessages.forEach(msg => {
        if (!msg.id || !existingIds.has(msg.id)) {
          // Check for duplicate by content and timestamp
          const isDuplicate = existingMessages.some(
            m => m.content === msg.content && 
            m.timestamp === msg.timestamp && 
            m.role === msg.role
          );
          
          if (!isDuplicate) {
            merged.push(msg);
            if (msg.id) {
              existingIds.add(msg.id);
            }
          }
        }
      });

      // Sort by timestamp
      merged.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeA - timeB;
      });

      this.saveMessages(threadId, merged);
    } catch (error) {
      this.handleStorageError(error as Error, 'addMessages');
    }
  }

  removeMessages(threadId: string): void {
    if (!this.isAvailable()) return;

    try {
      localStorage.removeItem(`${STORAGE_KEYS.MESSAGES}${threadId}`);
    } catch (error) {
      this.handleStorageError(error as Error, 'removeMessages');
    }
  }

  // Sync Management
  getLastSync(): Date | null {
    if (!this.isAvailable()) return null;

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      return stored ? new Date(stored) : null;
    } catch {
      return null;
    }
  }

  // Clear all data (useful for debugging or reset)
  clearAll(): void {
    if (!this.isAvailable()) return;

    try {
      // Remove all message entries
      const threads = this.getThreads();
      threads.forEach(thread => {
        localStorage.removeItem(`${STORAGE_KEYS.MESSAGES}${thread.thread_id}`);
      });

      // Remove threads and sync info
      localStorage.removeItem(STORAGE_KEYS.THREADS);
      localStorage.removeItem(STORAGE_KEYS.LAST_SYNC);
    } catch (error) {
      this.handleStorageError(error as Error, 'clearAll');
    }
  }

  // Get storage usage info
  getStorageInfo(): { used: number; available: number; percentage: number } {
    if (!this.isAvailable()) {
      return { used: 0, available: 0, percentage: 0 };
    }

    try {
      let used = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length + key.length;
        }
      }
      
      // Most browsers have ~5-10MB limit
      const estimatedLimit = 5 * 1024 * 1024; // 5MB
      const available = Math.max(0, estimatedLimit - used);
      const percentage = (used / estimatedLimit) * 100;

      return { used, available, percentage };
    } catch {
      return { used: 0, available: 0, percentage: 0 };
    }
  }
}

export const storage = new StorageService();

