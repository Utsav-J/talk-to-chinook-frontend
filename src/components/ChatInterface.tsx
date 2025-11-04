import { useState, useEffect, useRef } from 'react';
import type { Message } from '../types/api';
import { api, ApiError } from '../services/api';
import './ChatInterface.css';

interface ChatInterfaceProps {
  threadId: string | null;
  onThreadCreated: (threadId: string) => void;
  onError?: (error: string) => void;
}

export function ChatInterface({ threadId, onThreadCreated, onError }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (threadId) {
      loadMessages(threadId);
    } else {
      setMessages([]);
    }
  }, [threadId]);

  const loadMessages = async (tid: string) => {
    setLoadingMessages(true);
    try {
      const data = await api.getMessages(tid, 200, 0);
      setMessages(data.messages);
    } catch (err) {
      if (err instanceof ApiError) {
        const errorMsg = `Failed to load messages: ${err.detail}`;
        console.error(errorMsg);
        onError?.(errorMsg);
      } else {
        const errorMsg = 'Failed to load messages. Please try again.';
        console.error(errorMsg);
        onError?.(errorMsg);
      }
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async (message: string) => {
    if (!message.trim() || loading) return;

    const userMessage: Message = {
      id: null,
      role: 'user',
      content: message.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.sendMessage(message.trim(), threadId || undefined);
      
      if (!threadId) {
        onThreadCreated(response.thread_id);
      }

      const assistantMessage: Message = {
        id: response.message_id,
        role: 'assistant',
        content: response.response,
        timestamp: response.timestamp,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      // Remove the user message if sending failed
      setMessages(prev => prev.slice(0, -1));
      
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
    try {
      await sendMessage(input);
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
        <div className="empty-chat">
          <h2>Welcome to Chinook Data Speech Agent</h2>
          <p>Start a new conversation to begin chatting with the agent.</p>
          <p className="hint">The agent can help you query the Chinook database. First, tell it your name!</p>
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
              <div className="message-content">
                <div className="message-text">{msg.content}</div>
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

