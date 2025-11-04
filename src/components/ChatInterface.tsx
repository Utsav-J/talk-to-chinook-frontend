import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Message } from '../types/api';
import { api, ApiError } from '../services/api';
import { storage } from '../services/storage';
import { generateThreadTitle } from '../utils/threadTitle';
import './ChatInterface.css';

interface ChatInterfaceProps {
  threadId: string | null;
  onThreadCreated: (threadId: string) => void;
  onError?: (error: string) => void;
}

// Filter messages to only show user messages and assistant messages with content
// Hide tool messages and empty assistant messages
const filterMessages = (messages: Message[]): Message[] => {
  return messages.filter(msg => {
    // Always show user messages
    if (msg.role === 'user') {
      return true;
    }
    // Only show assistant messages with non-empty content
    if (msg.role === 'assistant') {
      return msg.content && msg.content.trim().length > 0;
    }
    // Hide tool messages and other roles
    return false;
  });
};

export function ChatInterface({ threadId, onThreadCreated, onError }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const updateThreadTitle = (tid: string, allMessages: Message[]) => {
    const title = generateThreadTitle(allMessages);
    if (title) {
      // Get current thread info
      const thread = storage.getThread(tid);
      if (thread) {
        // Update thread title
        const updatedThread = {
          ...thread,
          title,
        };
        storage.addOrUpdateThread(updatedThread);
        // Trigger thread list refresh
        window.dispatchEvent(new Event('threadUpdated'));
      } else {
        // Thread might not be in cache yet, try to get from API
        // For now, just save with the title we generated
        // The thread will be synced when the list refreshes
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (threadId) {
      // Load from cache first for instant display
      const cachedMessages = storage.getMessages(threadId);
      if (cachedMessages.length > 0) {
        setMessages(filterMessages(cachedMessages));
        // Update title from cached messages too
        updateThreadTitle(threadId, cachedMessages);
      }
      // Then sync with API
      loadMessages(threadId);
    } else {
      setMessages([]);
    }
  }, [threadId]);

  const loadMessages = async (tid: string) => {
    setLoadingMessages(true);
    try {
      const data = await api.getMessages(tid, 200, 0);
      const filtered = filterMessages(data.messages);
      setMessages(filtered);
      // Save to localStorage (save all messages, but display filtered)
      storage.saveMessages(tid, data.messages);
      // Update thread title based on messages
      updateThreadTitle(tid, data.messages);
    } catch (err) {
      if (err instanceof ApiError) {
        const errorMsg = `Failed to load messages: ${err.detail}`;
        console.error(errorMsg);
        // If API fails, try to use cached messages if we don't have any
        const cachedMessages = storage.getMessages(tid);
        if (cachedMessages.length > 0) {
          // Only show error if we don't have cached messages to fall back to
          if (messages.length === 0) {
            setMessages(filterMessages(cachedMessages));
          }
          // Still show error but don't block UI
          onError?.(`${errorMsg} (showing cached messages)`);
        } else {
          onError?.(errorMsg);
        }
      } else {
        const errorMsg = 'Failed to load messages. Please try again.';
        console.error(errorMsg);
        // Fallback to cache if available
        const cachedMessages = storage.getMessages(tid);
        if (cachedMessages.length > 0 && messages.length === 0) {
          setMessages(filterMessages(cachedMessages));
          onError?.('Network error. Showing cached messages.');
        } else {
          onError?.(errorMsg);
        }
      }
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async (message: string, overrideThreadId?: string) => {
    if (!message.trim() || loading) return;

    // Use override threadId if provided, otherwise use component's threadId
    let finalThreadId = overrideThreadId || threadId;

    // This should not happen if called from handleSubmit, but keep as safeguard
    if (!finalThreadId) {
      throw new Error('Thread ID is required to send a message');
    }

    const userMessage: Message = {
      id: null,
      role: 'user',
      content: message.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    // Save user message to localStorage
    storage.addMessage(finalThreadId, userMessage);
    // Update thread title after adding user message
    const allMessages = storage.getMessages(finalThreadId);
    updateThreadTitle(finalThreadId, allMessages);
    
    setInput('');
    setLoading(true);

    try {
      // Now send the message with the thread_id
      const response = await api.sendMessage(message.trim(), finalThreadId);

      const assistantMessage: Message = {
        id: response.message_id,
        role: 'assistant',
        content: response.response,
        timestamp: response.timestamp,
      };

      // Only add assistant message if it has content
      if (assistantMessage.content && assistantMessage.content.trim().length > 0) {
        setMessages(prev => [...prev, assistantMessage]);
        // Save assistant message to localStorage
        storage.addMessage(finalThreadId, assistantMessage);
        
        // Update thread title after adding messages
        const allMessages = storage.getMessages(finalThreadId);
        updateThreadTitle(finalThreadId, allMessages);
      }
    } catch (err) {
      // Remove the user message if sending failed
      setMessages(prev => {
        const updated = prev.slice(0, -1);
        // Also remove from localStorage
        if (finalThreadId) {
          const messages = storage.getMessages(finalThreadId);
          const filtered = messages.filter(m => 
            !(m.content === userMessage.content && 
              m.role === userMessage.role && 
              m.timestamp === userMessage.timestamp)
          );
          storage.saveMessages(finalThreadId, filtered);
        }
        return updated;
      });
      
      if (err instanceof ApiError) {
        throw new Error(err.detail || 'Failed to send message');
      } else {
        throw new Error('Failed to send message. Please try again.');
      }
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    
    const messageText = input.trim();
    let threadIdToUse = threadId;
    
    // If no threadId, create thread first and immediately navigate to chat view
    if (!threadIdToUse) {
      try {
        setLoading(true);
        const newThread = await api.createThread();
        threadIdToUse = newThread.thread_id;
        // Save thread to localStorage
        storage.addOrUpdateThread(newThread);
        // Immediately notify parent to switch to chat view
        // This will cause a re-render with the new threadId
        onThreadCreated(threadIdToUse);
        // Small delay to allow the re-render to complete before adding messages
        await new Promise(resolve => setTimeout(resolve, 0));
      } catch (err) {
        setLoading(false);
        const errorMessage = err instanceof ApiError 
          ? (err.detail || 'Failed to create thread')
          : 'Failed to create thread. Please try again.';
        onError?.(errorMessage);
        return;
      }
    }
    
    try {
      // sendMessage will add the user message and send to backend
      await sendMessage(messageText, threadIdToUse);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message. Please try again.';
      onError?.(errorMessage);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!threadId) {
    return (
      <div className="chat-interface empty-state">
        <div className="welcome-container">
          <div className="welcome-header">
            <h1 className="welcome-title">
              Hello <span className="gradient-text">there!</span>
            </h1>
            <p className="welcome-subtitle">How can I help you today?</p>
          </div>

          <div className="feature-cards">
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <h3 className="feature-title">Query Database</h3>
              <p className="feature-description">Ask questions about albums, artists, customers, and sales data</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3h7v7H3z"/>
                  <path d="M14 3h7v7h-7z"/>
                  <path d="M14 14h7v7h-7z"/>
                  <path d="M3 14h7v7H3z"/>
                </svg>
              </div>
              <h3 className="feature-title">Sales Analytics</h3>
              <p className="feature-description">Get insights into sales trends and customer purchases</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <path d="M14 2v6h6"/>
                  <path d="M16 13H8"/>
                  <path d="M16 17H8"/>
                  <path d="M10 9H8"/>
                </svg>
              </div>
              <h3 className="feature-title">Data Insights</h3>
              <p className="feature-description">Explore tracks, playlists, and comprehensive data analysis</p>
            </div>
          </div>

          <div className="welcome-input-container">
            <form className="welcome-input-form" onSubmit={handleSubmit}>
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="text"
                className="welcome-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Ask something..."
                disabled={loading}
              />
              <button
                type="submit"
                className="welcome-send-button"
                disabled={loading || !input.trim()}
                aria-label="Send message"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-interface">
      {loadingMessages && (
        <div className="loading-messages">
          <div className="spinner"></div>
          <span>Loading messages...</span>
        </div>
      )}

      <div className="messages-container">
        <div className="messages">
          {messages.map((msg, idx) => (
            <div key={msg.id || idx} className={`message ${msg.role}`}>
              {msg.role === 'assistant' && (
                <img 
                  src="/ai-icon.png" 
                  alt="AI Assistant" 
                  className="message-avatar" 
                />
              )}
              <div className="message-content">
                <div className="message-text">
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.timestamp && (
                  <div className="message-timestamp">
                    {formatTimestamp(msg.timestamp)}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="message assistant">
              <img 
                src="/ai-icon.png" 
                alt="AI Assistant" 
                className="message-avatar" 
              />
              <div className="message-content">
                <div className="message-text thinking">
                  <span className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                  Thinking...
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <div className="input-container">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
            rows={1}
            disabled={loading}
            style={{
              minHeight: '24px',
              maxHeight: '120px',
              height: 'auto',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
          <button
            type="submit"
            className="send-button"
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            {loading ? (
              <div className="spinner small"></div>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

