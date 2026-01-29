import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Message } from '../types/api';
import { api } from '../services/api';
import { storage } from '../services/storage';
import { generateThreadTitle } from '../utils/threadTitle';
import './ChatInterface.css';

// Lightweight runtime-safe aliases for SpeechRecognition types in environments without lib.dom
// These keep TypeScript happy without requiring global DOM lib augmentation.
// They intentionally use 'any' to avoid narrowing runtime behaviors.
type SpeechRecognition = any;
type SpeechRecognitionEvent = any;
type SpeechRecognitionErrorEvent = any;

const isApiError = (err: unknown): err is { detail?: string } => {
  return typeof err === 'object' && err !== null && 'detail' in (err as Record<string, unknown>);
};

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
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(false);
  const speechAccumRef = useRef<string>('');
  const speechBaseInputRef = useRef<string>('');
  const [speechInterim, setSpeechInterim] = useState('');
  // Track whether current input has been composed via voice
  const inputComposedByVoiceRef = useRef<boolean>(false);
  // When true at submit time, auto-speak the next assistant response
  const autoSpeakNextAssistantRef = useRef<boolean>(false);

  // TTS state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | number | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  // Minimal type shim for SpeechRecognition (for TS without DOM lib augmentations)
  type SpeechRecognitionConstructor = new () => SpeechRecognition;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - allow vendor-prefixed property runtime check
  const _SpeechRecognitionCtor: SpeechRecognitionConstructor | undefined = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

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

  useEffect(() => {
    setSpeechSupported(Boolean(_SpeechRecognitionCtor));
  }, []);

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      if (ttsAudioRef.current) {
        try {
          ttsAudioRef.current.pause();
          ttsAudioRef.current.currentTime = 0;
        } catch {}
        ttsAudioRef.current = null;
      }
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    };
  }, []);

  // Keyboard shortcuts: 'V' to start voice input, 'P' to stop while recording
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const active = document.activeElement as HTMLElement | null;
      const isTyping = !!active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
      if (isTyping) return;
      if (!speechSupported || loading) return;

      const key = e.key;
      if (!isRecording && (key === 'v' || key === 'V')) {
        e.preventDefault();
        startRecording();
      } else if (isRecording && (key === 'p' || key === 'P')) {
        e.preventDefault();
        stopRecording();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isRecording, speechSupported, loading]);

  // Resize textarea to fit content whenever input changes
  const resizeActiveTextarea = () => {
    const el = inputRef.current as HTMLTextAreaElement | null;
    if (!el || el.tagName !== 'TEXTAREA') return;
    el.style.height = 'auto';
    const maxHeight = 240; // px, cap growth for usability
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  };

  useEffect(() => {
    resizeActiveTextarea();
  }, [input]);

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
      if (isApiError(err)) {
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
        debug_info: response.debug_info,
      };

      // Only add assistant message if it has content
      if (assistantMessage.content && assistantMessage.content.trim().length > 0) {
        setMessages(prev => [...prev, assistantMessage]);
        // Save assistant message to localStorage
        storage.addMessage(finalThreadId, assistantMessage);
        
        // Update thread title after adding messages
        const allMessages = storage.getMessages(finalThreadId);
        updateThreadTitle(finalThreadId, allMessages);

        // Auto TTS if the user message was voice-composed
        if (autoSpeakNextAssistantRef.current) {
          autoSpeakNextAssistantRef.current = false;
          speakText(assistantMessage.id || null, assistantMessage.content);
        }
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
      
      if (isApiError(err)) {
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
    // If input was composed via voice, auto-speak the next assistant response
    autoSpeakNextAssistantRef.current = inputComposedByVoiceRef.current;
    // Reset the composition flag now that we're submitting
    inputComposedByVoiceRef.current = false;
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
        const errorMessage = isApiError(err) 
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

  const startRecording = () => {
    if (!_SpeechRecognitionCtor || isRecording) return;
    try {
      // Initialize buffers so that only final results are shown
      speechBaseInputRef.current = input;
      speechAccumRef.current = '';
      const recognition = new _SpeechRecognitionCtor();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        if (finalTranscript) {
          speechAccumRef.current += finalTranscript;
          const base = speechBaseInputRef.current.trimEnd();
          const acc = speechAccumRef.current.trimStart();
          const combined = base && acc ? `${base} ${acc}` : `${base}${acc}`;
          setInput(combined);
          setSpeechInterim('');
          inputComposedByVoiceRef.current = true;
        } else {
          setSpeechInterim(interimTranscript);
          if (interimTranscript) {
            inputComposedByVoiceRef.current = true;
          }
        }
      };

      recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
        setIsRecording(false);
        if (e.error !== 'no-speech') {
          onError?.(`Speech recognition error: ${e.error}`);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
        // Clear interim state on end (finals have already been applied)
        speechAccumRef.current = speechAccumRef.current.trim();
        setSpeechInterim('');
      };

      recognition.start();
      setIsRecording(true);
    } catch (err) {
      setIsRecording(false);
      onError?.('Unable to start speech recognition.');
    }
  };

  const stopRecording = () => {
    const recognition = recognitionRef.current as SpeechRecognition | null;
    if (recognition) {
      // When stopping, commit any interim transcript as final into the input
      const base = speechBaseInputRef.current.trimEnd();
      const acc = speechAccumRef.current.trim();
      const interim = speechInterim.trim();
      const spoken = [acc, interim].filter(Boolean).join(' ').trim();
      const combined = base && spoken ? `${base} ${spoken}` : `${base}${spoken}`;
      if (combined) {
        setInput(combined);
      }
      setSpeechInterim('');
      recognition.onresult = null as unknown as (ev: Event) => void;
      try { recognition.stop(); } catch {}
    }
    setIsRecording(false);
  };

  // TTS controls using Puter.js
  const stopTTS = () => {
    const audio = ttsAudioRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
      ttsAudioRef.current = null;
    }
    setIsSpeaking(false);
    setSpeakingMessageId(null);
  };

  const speakText = async (messageId: string | number | null, text: string) => {
    if (!text || !text.trim()) return;
    try {
      // Stop any ongoing playback first
      stopTTS();

      const puter = (window as any).puter;
      if (!puter || !puter.ai || !puter.ai.txt2speech) {
        onError?.('Text-to-Speech not available. Ensure Puter.js is loaded.');
        return;
      }

      setSpeakingMessageId(messageId);
      setIsSpeaking(true);

      const audio: HTMLAudioElement = await puter.ai.txt2speech(text);
      ttsAudioRef.current = audio;

      const handleEnded = () => {
        setIsSpeaking(false);
        setSpeakingMessageId(null);
        if (ttsAudioRef.current === audio) {
          ttsAudioRef.current = null;
        }
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('error', handleError);
      };
      const handlePause = () => {
        // If paused because of stopTTS, state already updated there
      };
      const handleError = () => {
        setIsSpeaking(false);
        setSpeakingMessageId(null);
        onError?.('Failed to play audio.');
      };

      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('error', handleError);

      await audio.play();
    } catch (e) {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      onError?.('Failed to start text-to-speech.');
    }
  };

  const toggleRecording = () => {
    if (!speechSupported) {
      onError?.('Speech recognition is not supported in this browser.');
      return;
    }
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
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
              <div className="input-wrapper">
                {isRecording && (
                  <div className="input-ghost">
                    <span className="ghost-final">{input}</span>
                    {speechInterim && <span className="ghost-interim"> {speechInterim}</span>}
                  </div>
                )}
                <textarea
                  ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                  className={`welcome-input ${isRecording ? 'with-overlay' : ''}`}
                  value={input}
                  onChange={(e) => {
                    inputComposedByVoiceRef.current = false;
                    setInput(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  placeholder="Ask something..."
                  disabled={loading}
                  rows={1}
                />
              </div>
              <button
                type="button"
                className={`mic-button ${isRecording ? 'recording' : ''}`}
                onClick={toggleRecording}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                title={speechSupported ? (isRecording ? 'Stop recording' : 'Start recording') : 'Speech not supported in this browser'}
                disabled={loading}
              >
                {isRecording ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="7" y="7" width="10" height="10" rx="2" ry="2"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3z"/>
                    <path d="M19 11a7 7 0 0 1-14 0"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                )}
                <span className="mic-pulse" aria-hidden="true"></span>
              </button>
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
                {msg.role === 'assistant' && msg.content?.trim() && (
                  <div className="tts-controls">
                    <button
                      type="button"
                      className={`tts-button ${isSpeaking && (speakingMessageId === (msg.id || idx)) ? 'speaking' : ''}`}
                      onClick={() => speakText(msg.id || idx, msg.content)}
                      aria-label="Speak message"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M11 5l6 4-6 4V5z"/>
                        <path d="M4 19a9 9 0 0 0 0-14"/>
                      </svg>
                      <span>{isSpeaking && (speakingMessageId === (msg.id || idx)) ? 'Speaking…' : 'Speak'}</span>
                    </button>
                  </div>
                )}
                {msg.role === 'assistant' && msg.debug_info && (
                  <div className="debug-info-container">
                    <details className="debug-details">
                      <summary>Debug Details</summary>
                      <div className="debug-content">
                        <div className="debug-meta">
                          <span className="debug-label">Model:</span> {msg.debug_info.model_name || 'Unknown'}
                          <span className="debug-separator">|</span>
                          <span className="debug-label">Steps:</span> {msg.debug_info.step_count}
                        </div>
                        {msg.debug_info.tool_calls && msg.debug_info.tool_calls.length > 0 && (
                          <div className="debug-tools">
                            <div className="debug-tools-header">Tool Execution:</div>
                            <ul className="debug-tools-list">
                              {msg.debug_info.tool_calls.map((tool, toolIdx) => (
                                <li key={toolIdx} className="debug-tool-item">
                                  <div className="debug-tool-name">{tool.tool_name}</div>
                                  <div className="debug-tool-args">
                                    <span className="debug-label">Args:</span> 
                                    <pre>{JSON.stringify(tool.args, null, 2)}</pre>
                                  </div>
                                  <div className="debug-tool-output">
                                    <span className="debug-label">Output:</span>
                                    <pre>{tool.output || '(No output)'}</pre>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </details>
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
          <div className="input-wrapper">
            {isRecording && (
              <div className="input-ghost">
                <span className="ghost-final">{input}</span>
                {speechInterim && <span className="ghost-interim"> {speechInterim}</span>}
              </div>
            )}
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              className={`chat-input ${isRecording ? 'with-overlay' : ''}`}
              value={input}
              onChange={(e) => {
                inputComposedByVoiceRef.current = false;
                setInput(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
              rows={1}
              disabled={loading}
              
            />
          </div>
          <button
            type="button"
            className={`mic-button ${isRecording ? 'recording' : ''}`}
            onClick={toggleRecording}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            title={speechSupported ? (isRecording ? 'Stop recording' : 'Start recording') : 'Speech not supported in this browser'}
            disabled={loading}
          >
          {isRecording ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="7" y="7" width="10" height="10" rx="2" ry="2"/>
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3z"/>
              <path d="M19 11a7 7 0 0 1-14 0"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          )}
            <span className="mic-pulse" aria-hidden="true"></span>
          </button>
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

      {isSpeaking && (
        <div className="tts-stop-overlay">
          <button
            type="button"
            className="tts-stop-button"
            onClick={stopTTS}
            aria-label="Stop dictation"
            title="Stop dictation"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="7" y="7" width="10" height="10" rx="2" ry="2"/>
            </svg>
            <span>Stop</span>
          </button>
        </div>
      )}
    </div>
  );
}


