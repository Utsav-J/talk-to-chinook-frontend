import { useState, useEffect } from 'react';
import type { ThreadInfo } from '../types/api';
import { api, ApiError } from '../services/api';
import './ThreadSidebar.css';

interface ThreadSidebarProps {
  currentThreadId: string | null;
  onThreadSelect: (threadId: string) => void;
  onThreadCreate: () => void;
  onThreadDeleted: (threadId: string) => void;
}

export function ThreadSidebar({
  currentThreadId,
  onThreadSelect,
  onThreadCreate,
  onThreadDeleted,
}: ThreadSidebarProps) {
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadThreads = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listThreads(50, 0);
      setThreads(data.threads);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else {
        setError('Failed to load threads');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThreads();
    
    const handleThreadCreated = () => {
      loadThreads();
    };
    
    window.addEventListener('threadCreated', handleThreadCreated);
    return () => {
      window.removeEventListener('threadCreated', handleThreadCreated);
    };
  }, []);

  const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) {
      return;
    }

    try {
      await api.deleteThread(threadId);
      setThreads(threads.filter(t => t.thread_id !== threadId));
      onThreadDeleted(threadId);
    } catch (err) {
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
        <h2>Conversations</h2>
        <button className="new-thread-btn" onClick={onThreadCreate}>
          + New
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
                    <span className="thread-message-count">
                      {thread.message_count || 0} messages
                    </span>
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

