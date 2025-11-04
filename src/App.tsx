import { useState, useEffect } from 'react';
import { ThreadSidebar } from './components/ThreadSidebar';
import { ChatInterface } from './components/ChatInterface';
import { ErrorNotification } from './components/ErrorNotification';
import { api, ApiError } from './services/api';
import './App.css';

function App() {
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<'checking' | 'healthy' | 'unhealthy'>('checking');

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      await api.healthCheck();
      setHealthStatus('healthy');
    } catch (err) {
      setHealthStatus('unhealthy');
      if (err instanceof ApiError) {
        showError(`Backend unavailable: ${err.detail}`);
      } else {
        showError('Backend unavailable. Please ensure the API server is running.');
      }
    }
  };

  const showError = (message: string) => {
    setError(message);
  };

  const handleCreateThread = async () => {
    try {
      const thread = await api.createThread();
      setCurrentThreadId(thread.thread_id);
    } catch (err) {
      if (err instanceof ApiError) {
        showError(`Failed to create thread: ${err.detail}`);
      } else {
        showError('Failed to create thread. Please try again.');
      }
    }
  };

  const handleThreadSelect = (threadId: string) => {
    setCurrentThreadId(threadId);
  };

  const handleThreadCreated = (threadId: string) => {
    setCurrentThreadId(threadId);
    // Trigger a refresh of the thread list by reloading the sidebar
    // This is handled by the ThreadSidebar component's useEffect
    window.dispatchEvent(new Event('threadCreated'));
  };

  const handleThreadDeleted = (threadId: string) => {
    if (currentThreadId === threadId) {
      setCurrentThreadId(null);
    }
  };

  return (
    <div className="app">
      {error && (
        <ErrorNotification
          message={error}
          onClose={() => setError(null)}
        />
      )}
      
      {healthStatus === 'unhealthy' && (
        <div className="health-warning">
          <span>⚠️ Backend API is unavailable</span>
          <button onClick={checkHealth}>Retry</button>
        </div>
      )}

      <div className="app-container">
        <ThreadSidebar
          currentThreadId={currentThreadId}
          onThreadSelect={handleThreadSelect}
          onThreadCreate={handleCreateThread}
          onThreadDeleted={handleThreadDeleted}
        />
        <ChatInterface
          threadId={currentThreadId}
          onThreadCreated={handleThreadCreated}
          onError={showError}
        />
      </div>
    </div>
  );
}

export default App;
