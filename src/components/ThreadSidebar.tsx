import { useState, useEffect } from 'react';
import type { ThreadInfo } from '../types/api';
import { api, ApiError } from '../services/api';
import { storage } from '../services/storage';
import { useTheme } from '../contexts/ThemeContext';
import './ThreadSidebar.css';

interface ThreadSidebarProps {
  currentThreadId: string | null;
  onThreadSelect: (threadId: string) => void;
  onThreadDeleted: (threadId: string) => void;
  onNavigateToHome: () => void;
}

export function ThreadSidebar({
  currentThreadId,
  onThreadSelect,
  onThreadDeleted,
  onNavigateToHome,
}: ThreadSidebarProps) {
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();

  const loadThreads = async (useCache = true) => {
    // Load from cache first for instant display
    if (useCache) {
      const cachedThreads = storage.getThreads();
      if (cachedThreads.length > 0) {
        setThreads(cachedThreads);
        setLoading(false);
      }
    }

    // Then sync with API (only show loading if we didn't have cache)
    if (!useCache || threads.length === 0) {
      setLoading(true);
    }
    setError(null);
    
    try {
      const data = await api.listThreads(50, 0);
      setThreads(data.threads);
      // Save to localStorage
      storage.saveThreads(data.threads);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
        // If API fails but we have cached data, keep showing it
        const cachedThreads = storage.getThreads();
        if (cachedThreads.length > 0 && threads.length === 0) {
          setThreads(cachedThreads);
        }
      } else {
        setError('Failed to load threads');
        // Fallback to cache if available
        const cachedThreads = storage.getThreads();
        if (cachedThreads.length > 0 && threads.length === 0) {
          setThreads(cachedThreads);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load from cache first, then sync with API
    loadThreads(true);
    
    const handleThreadCreated = () => {
      loadThreads(false); // Force API sync
    };
    
    const handleThreadUpdated = () => {
      // Reload threads from cache to get updated titles
      const cachedThreads = storage.getThreads();
      if (cachedThreads.length > 0) {
        setThreads(cachedThreads);
      }
      // Also sync with API in background
      loadThreads(false);
    };
    
    window.addEventListener('threadCreated', handleThreadCreated);
    window.addEventListener('threadUpdated', handleThreadUpdated);
    return () => {
      window.removeEventListener('threadCreated', handleThreadCreated);
      window.removeEventListener('threadUpdated', handleThreadUpdated);
    };
  }, []);

  const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) {
      return;
    }

    // Optimistically remove from UI
    const updatedThreads = threads.filter(t => t.thread_id !== threadId);
    setThreads(updatedThreads);
    storage.removeThread(threadId);
    onThreadDeleted(threadId);

    // Then sync with API
    try {
      await api.deleteThread(threadId);
    } catch (err) {
      // Revert on error
      setThreads(threads);
      loadThreads(false);
      if (err instanceof ApiError) {
        alert(`Failed to delete thread: ${err.detail}`);
      } else {
        alert('Failed to delete thread');
      }
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="thread-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo" onClick={onNavigateToHome}>
          <img src="/ai-icon.png" alt="AI Assistant" className="logo-icon" />
          <h2>Conversations</h2>
        </div>
        <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'light' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          )}
        </button>
      </div>

      {loading && (
        <div className="sidebar-loading">
          <div className="spinner"></div>
          <span>Loading conversations...</span>
        </div>
      )}

      {error && (
        <div className="sidebar-error">
          <p>{error}</p>
          <button onClick={loadThreads}>Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div className="threads-list">
          {threads.length === 0 ? (
            <div className="empty-state">
              <p>No conversations yet</p>
              <p className="empty-hint">Start a new conversation to begin</p>
            </div>
          ) : (
            threads.map(thread => (
              <div
                key={thread.thread_id}
                className={`thread-item ${currentThreadId === thread.thread_id ? 'active' : ''}`}
                onClick={() => onThreadSelect(thread.thread_id)}
              >
                <div className="thread-content">
                  <h3 className="thread-title">
                    {thread.title || 'New Conversation'}
                  </h3>
                  <div className="thread-meta">
                    <span className="thread-date">
                      {formatDate(thread.last_activity)}
                    </span>
                  </div>
                </div>
                <button
                  className="thread-delete-btn"
                  onClick={(e) => handleDeleteThread(thread.thread_id, e)}
                  aria-label="Delete conversation"
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

