# Chinook Data Speech Agent - API Documentation

Complete API reference for frontend developers integrating with the Chinook Data Speech Agent backend.


## Authentication

Currently, the API does not require authentication. All endpoints are publicly accessible.

## Content Type

All requests should include:
```
Content-Type: application/json
```

## API Endpoints

### 1. Health Check

Check if the API is running and healthy.

**Endpoint:** `GET /health` or `GET /`

**Response:**
```json
{
  "status": "healthy",
  "agent_name": "sql_agent"
}
```

**Example:**
```javascript
const response = await fetch('http://localhost:8000/health');
const data = await response.json();
console.log(data.status); // "healthy"
```

---

### 2. Create Thread

Create a new conversation thread. Threads are used to maintain conversation context.

**Endpoint:** `POST /threads`

**Request Body:**
```json
{
  "thread_id": "optional-custom-id",  // Optional, UUID generated if omitted
  "title": "Optional thread title"    // Optional
}
```

**Response (201 Created):**
```json
{
  "thread_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2024-01-15T10:30:00.000Z",
  "last_activity": "2024-01-15T10:30:00.000Z",
  "title": "New Conversation",
  "message_count": 0
}
```

**TypeScript Interface:**
```typescript
interface ThreadCreate {
  thread_id?: string;
  title?: string;
}

interface ThreadInfo {
  thread_id: string;
  created_at: string | null;      // ISO 8601 format
  last_activity: string | null;   // ISO 8601 format
  title: string | null;
  message_count: number | null;
}
```

**Example:**
```javascript
const response = await fetch('http://localhost:8000/threads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'My Conversation' })
});
const thread = await response.json();
const threadId = thread.thread_id;
```

---

### 3. List All Threads

Get a paginated list of all conversation threads, sorted by last activity (most recent first).

**Endpoint:** `GET /threads`

**Query Parameters:**
- `limit` (optional, default: 20, min: 1, max: 100) - Number of threads to return
- `offset` (optional, default: 0, min: 0) - Number of threads to skip

**Response (200 OK):**
```json
{
  "threads": [
    {
      "thread_id": "550e8400-e29b-41d4-a716-446655440000",
      "created_at": "2024-01-15T10:30:00.000Z",
      "last_activity": "2024-01-15T11:45:00.000Z",
      "title": "Im frank harris",
      "message_count": 5
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

**TypeScript Interface:**
```typescript
interface ThreadListResponse {
  threads: ThreadInfo[];
  total: number;
  limit: number;
  offset: number;
}
```

**Example:**
```javascript
const response = await fetch('http://localhost:8000/threads?limit=10&offset=0');
const data = await response.json();
console.log(`Total threads: ${data.total}`);
data.threads.forEach(thread => {
  console.log(`${thread.title} - ${thread.message_count} messages`);
});
```

---

### 4. Get Thread Metadata

Get detailed metadata for a specific thread.

**Endpoint:** `GET /threads/{thread_id}`

**Path Parameters:**
- `thread_id` (required) - The thread identifier

**Response (200 OK):**
```json
{
  "thread_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2024-01-15T10:30:00.000Z",
  "last_activity": "2024-01-15T11:45:00.000Z",
  "title": "Im frank harris",
  "message_count": 5
}
```

**Example:**
```javascript
const threadId = '550e8400-e29b-41d4-a716-446655440000';
const response = await fetch(`http://localhost:8000/threads/${threadId}`);
const thread = await response.json();
```

---

### 5. Get Thread Messages

Retrieve message history for a thread with pagination.

**Endpoint:** `GET /threads/{thread_id}/messages`

**Path Parameters:**
- `thread_id` (required) - The thread identifier

**Query Parameters:**
- `limit` (optional, default: 50, min: 1, max: 200) - Number of messages to return
- `offset` (optional, default: 0, min: 0) - Number of messages to skip

**Response (200 OK):**
```json
{
  "messages": [
    {
      "id": "msg-123",
      "role": "user",
      "content": "im frank harris",
      "timestamp": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": "msg-124",
      "role": "assistant",
      "content": "Hello Frank! How can I help you today?",
      "timestamp": "2024-01-15T10:30:05.000Z"
    }
  ],
  "thread_id": "550e8400-e29b-41d4-a716-446655440000",
  "total": 2,
  "limit": 50,
  "offset": 0
}
```

**TypeScript Interface:**
```typescript
interface Message {
  id: string | null;
  role: 'user' | 'assistant' | 'tool' | 'unknown';
  content: string;
  timestamp: string | null;  // ISO 8601 format
}

interface MessagesResponse {
  messages: Message[];
  thread_id: string;
  total: number;
  limit: number;
  offset: number;
}
```

**Example:**
```javascript
const threadId = '550e8400-e29b-41d4-a716-446655440000';
const response = await fetch(
  `http://localhost:8000/threads/${threadId}/messages?limit=50&offset=0`
);
const data = await response.json();
data.messages.forEach(msg => {
  console.log(`${msg.role}: ${msg.content}`);
});
```

---

### 6. Send Chat Message

Send a message to the agent and get a response. The agent will process the message and return a response. If `thread_id` is not provided, a new thread is automatically created.

**Endpoint:** `POST /chat`

**Request Body:**
```json
{
  "message": "im frank harris",
  "thread_id": "550e8400-e29b-41d4-a716-446655440000"  // Optional
}
```

**Response (200 OK):**
```json
{
  "response": "Hello Frank! How can I help you today?",
  "thread_id": "550e8400-e29b-41d4-a716-446655440000",
  "message_id": "msg-124",
  "timestamp": "2024-01-15T10:30:05.000Z",
  "debug_info": {
    "step_count": 2,
    "tool_calls": [
      {
        "tool_name": "update_user_name",
        "args": {
          "new_first_name": "Frank",
          "new_last_name": "Harris"
        },
        "tool_call_id": "call_12345",
        "output": "Updated user name to Frank Harris."
      }
    ],
    "model_name": "gemini-2.5-flash"
  }
}
```

**TypeScript Interface:**
```typescript
interface ToolCallInfo {
  tool_name: string;
  args: Record<string, any>;
  tool_call_id: string;
  output: string | null;
}

interface AgentDebugInfo {
  step_count: number;
  tool_calls: ToolCallInfo[];
  model_name: string | null;
}

interface ChatRequest {
  message: string;
  thread_id?: string;
}

interface ChatResponse {
  response: string;
  thread_id: string;
  message_id: string | null;
  timestamp: string | null;  // ISO 8601 format
  debug_info: AgentDebugInfo | null;
}
```

**Example:**
```javascript
const response = await fetch('http://localhost:8000/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'im frank harris',
    thread_id: 'existing-thread-id'  // Optional
  })
});

const data = await response.json();
console.log(`Agent: ${data.response}`);
console.log(`Thread ID: ${data.thread_id}`);
console.log(`Timestamp: ${data.timestamp}`);
if (data.debug_info) {
  console.log(`Steps taken: ${data.debug_info.step_count}`);
  data.debug_info.tool_calls.forEach(tool => {
      console.log(`Used Tool: ${tool.tool_name} with args: ${JSON.stringify(tool.args)}`);
  });
}
```

**Important Notes:**
- If `thread_id` is not provided, a new thread is created automatically
- The thread title is auto-generated from the first message
- Request timeout is 30 seconds - longer requests will return 504 Gateway Timeout
- The agent enforces name validation before allowing SQL queries

---

### 7. Delete Thread

Delete a conversation thread and all its associated data.

**Endpoint:** `DELETE /threads/{thread_id}`

**Path Parameters:**
- `thread_id` (required) - The thread identifier to delete

**Response (200 OK):**
```json
{
  "thread_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "deleted",
  "message": "Thread deleted successfully"
}
```

**Example:**
```javascript
const threadId = '550e8400-e29b-41d4-a716-446655440000';
const response = await fetch(`http://localhost:8000/threads/${threadId}`, {
  method: 'DELETE'
});
const result = await response.json();
console.log(result.message); // "Thread deleted successfully"
```

---

## Error Handling

All endpoints return appropriate HTTP status codes and error messages.

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server error occurred |
| 504 | Gateway Timeout | Request timed out (30 seconds) |

### Error Response Format

All errors follow this format:
```json
{
  "detail": "Error message describing what went wrong"
}
```

### Common Error Scenarios

**Invalid Request:**
```json
{
  "detail": "Invalid request: validation error message"
}
```

**Timeout Error:**
```json
{
  "detail": "Request timeout. The agent took too long to respond. Please try again."
}
```

**Agent Error:**
```json
{
  "detail": "Agent error: detailed error message"
}
```

**Example Error Handling:**
```javascript
try {
  const response = await fetch('http://localhost:8000/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'test' })
  });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 504) {
      console.error('Request timed out:', error.detail);
    } else if (response.status === 500) {
      console.error('Server error:', error.detail);
    } else {
      console.error('Error:', error.detail);
    }
    return;
  }

  const data = await response.json();
  console.log(data.response);
} catch (error) {
  console.error('Network error:', error);
}
```

---

## Complete React Example

Here's a complete React component example:

```typescript
import React, { useState, useEffect } from 'react';

interface Message {
  id: string | null;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string | null;
}

interface Thread {
  thread_id: string;
  title: string | null;
  message_count: number | null;
  last_activity: string | null;
}

const API_BASE = 'http://localhost:8000';

const ChatApp: React.FC = () => {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);

  // Create a new thread
  const createThread = async () => {
    try {
      const response = await fetch(`${API_BASE}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const thread = await response.json();
      setThreadId(thread.thread_id);
      setMessages([]);
      return thread.thread_id;
    } catch (error) {
      console.error('Failed to create thread:', error);
      return null;
    }
  };

  // Load threads list
  const loadThreads = async () => {
    try {
      const response = await fetch(`${API_BASE}/threads?limit=20`);
      const data = await response.json();
      setThreads(data.threads);
    } catch (error) {
      console.error('Failed to load threads:', error);
    }
  };

  // Load messages for a thread
  const loadMessages = async (tid: string) => {
    try {
      const response = await fetch(`${API_BASE}/threads/${tid}/messages`);
      const data = await response.json();
      setMessages(data.messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  // Send a message
  const sendMessage = async (message: string) => {
    if (!message.trim()) return;

    const userMessage: Message = {
      id: null,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Create thread if doesn't exist
      let tid = threadId;
      if (!tid) {
        tid = await createThread();
        if (!tid) throw new Error('Failed to create thread');
      }

      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          thread_id: tid,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Request failed');
      }

      const data = await response.json();
      setThreadId(data.thread_id);

      const assistantMessage: Message = {
        id: data.message_id,
        role: 'assistant',
        content: data.response,
        timestamp: data.timestamp,
      };

      setMessages(prev => [...prev, assistantMessage]);
      loadThreads(); // Refresh threads list
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Delete a thread
  const deleteThread = async (tid: string) => {
    try {
      await fetch(`${API_BASE}/threads/${tid}`, {
        method: 'DELETE',
      });
      loadThreads();
      if (threadId === tid) {
        setThreadId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to delete thread:', error);
    }
  };

  useEffect(() => {
    loadThreads();
    if (threadId) {
      loadMessages(threadId);
    }
  }, [threadId]);

  return (
    <div className="chat-app">
      <div className="sidebar">
        <button onClick={createThread}>New Conversation</button>
        <div className="threads-list">
          {threads.map(thread => (
            <div key={thread.thread_id} className="thread-item">
              <div onClick={() => {
                setThreadId(thread.thread_id);
                loadMessages(thread.thread_id);
              }}>
                <h4>{thread.title || 'New Conversation'}</h4>
                <p>{thread.message_count} messages</p>
              </div>
              <button onClick={() => deleteThread(thread.thread_id)}>Delete</button>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-main">
        <div className="messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="role">{msg.role}</div>
              <div className="content">{msg.content}</div>
              {msg.timestamp && (
                <div className="timestamp">
                  {new Date(msg.timestamp).toLocaleString()}
                </div>
              )}
            </div>
          ))}
          {loading && <div className="loading">Thinking...</div>}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatApp;
```

---

## JavaScript/TypeScript API Client

Here's a reusable API client class:

```typescript
class ChinookAgentAPI {
  constructor(private baseURL: string = 'http://localhost:8000') {}

  async healthCheck(): Promise<{ status: string; agent_name: string }> {
    const response = await fetch(`${this.baseURL}/health`);
    return response.json();
  }

  async createThread(title?: string): Promise<ThreadInfo> {
    const response = await fetch(`${this.baseURL}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    return response.json();
  }

  async listThreads(limit = 20, offset = 0): Promise<ThreadListResponse> {
    const response = await fetch(
      `${this.baseURL}/threads?limit=${limit}&offset=${offset}`
    );
    return response.json();
  }

  async getThread(threadId: string): Promise<ThreadInfo> {
    const response = await fetch(`${this.baseURL}/threads/${threadId}`);
    return response.json();
  }

  async getMessages(
    threadId: string,
    limit = 50,
    offset = 0
  ): Promise<MessagesResponse> {
    const response = await fetch(
      `${this.baseURL}/threads/${threadId}/messages?limit=${limit}&offset=${offset}`
    );
    return response.json();
  }

  async sendMessage(
    message: string,
    threadId?: string
  ): Promise<ChatResponse> {
    const response = await fetch(`${this.baseURL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, thread_id: threadId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Request failed');
    }

    return response.json();
  }

  async deleteThread(threadId: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/threads/${threadId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Delete failed');
    }
  }
}

// Usage
const api = new ChinookAgentAPI();

// Create a thread and send a message
const thread = await api.createThread();
const response = await api.sendMessage('im frank harris', thread.thread_id);
console.log(response.response);

// Get message history
const messages = await api.getMessages(thread.thread_id);
console.log(`Thread has ${messages.total} messages`);
```

---

## Session Management

### Thread IDs

- Thread IDs are UUIDs (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- Each thread maintains its own conversation context
- The agent remembers user names and preferences per thread
- Thread state persists across requests

### Conversation Flow

1. **Create Thread** (optional): `POST /threads` to create a new thread
2. **Send Message**: `POST /chat` with `thread_id` to continue conversation
3. **Get History**: `GET /threads/{thread_id}/messages` to retrieve past messages
4. **Delete Thread**: `DELETE /threads/{thread_id}` to remove conversation

### Auto-Thread Creation

If you don't provide a `thread_id` in the chat request, a new thread is automatically created:
- Thread ID is returned in the response
- Title is auto-generated from the first message
- You can use this thread ID for subsequent messages

---

## Best Practices

### 1. Error Handling

Always handle errors gracefully:
```javascript
try {
  const response = await api.sendMessage('hello');
  // Handle success
} catch (error) {
  if (error.message.includes('timeout')) {
    // Show timeout message to user
  } else {
    // Show generic error
  }
}
```

### 2. Loading States

Show loading indicators during requests:
```javascript
const [loading, setLoading] = useState(false);

const sendMessage = async (message) => {
  setLoading(true);
  try {
    await api.sendMessage(message);
  } finally {
    setLoading(false);
  }
};
```

### 3. Timeout Handling

The API has a 30-second timeout. Consider:
- Showing a progress indicator for long requests
- Implementing client-side timeout (e.g., 35 seconds)
- Providing retry functionality

### 4. Message History

- Load message history when opening a thread
- Use pagination for large conversation histories
- Cache messages locally to reduce API calls

### 5. Thread Management

- Store thread IDs in localStorage or state management
- Refresh thread list after creating/deleting threads
- Show thread metadata (title, message count) in UI

### 6. CORS

The API is configured to allow all origins in development. For production:
- Update CORS settings in `fastapi_backend.py`
- Ensure your frontend domain is whitelisted

---

## Agent Behavior

### Name Validation

The agent requires users to provide their name before allowing SQL queries:
1. First message should include name: `"im frank harris"`
2. Agent validates name against database
3. Once validated, agent allows SQL queries
4. Agent addresses user by first name in responses

### Example Conversation Flow

```
User: "im frank harris"
Agent: "Hello Frank! How can I help you today?"

User: "what was my most cheap purchase?"
Agent: "Frank, your most inexpensive purchase was Invoice ID 13, totaling $0.99."

User: "what about the most expensive?"
Agent: "Frank, your most expensive purchase was Invoice ID 145, totaling $13.86."
```

---

## Rate Limiting

Currently, there is no rate limiting implemented. In production, consider:
- Implementing client-side rate limiting
- Monitoring request frequency
- Adding retry logic with exponential backoff

---

## Testing

### cURL Examples

```bash
# Health check
curl http://localhost:8000/health

# Create thread
curl -X POST http://localhost:8000/threads \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Conversation"}'

# List threads
curl http://localhost:8000/threads?limit=10

# Get thread metadata
curl http://localhost:8000/threads/{thread_id}

# Get messages
curl http://localhost:8000/threads/{thread_id}/messages?limit=50

# Send message
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "im frank harris", "thread_id": "your-thread-id"}'

# Delete thread
curl -X DELETE http://localhost:8000/threads/{thread_id}
```

### Postman Collection

You can import these endpoints into Postman for testing. All endpoints accept JSON and return JSON responses.

---

## Support & Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure your frontend domain is allowed in CORS settings
2. **Timeout Errors**: Requests taking longer than 30 seconds will timeout
3. **Invalid Thread ID**: Using a non-existent thread_id creates a new thread automatically
4. **Empty Messages**: Check that message content is not empty

### Debugging

Enable network logging in your browser DevTools to see:
- Request/response payloads
- HTTP status codes
- Response times
- Error messages

---

## Additional Resources

- **API Documentation**: Interactive docs available at `http://localhost:8000/docs` (Swagger UI)
- **Alternative API Docs**: ReDoc available at `http://localhost:8000/redoc`
- **Source Code**: See `fastapi_backend.py` for implementation details

---

## Type Definitions Summary

```typescript
// Thread Management
interface ThreadInfo {
  thread_id: string;
  created_at: string | null;
  last_activity: string | null;
  title: string | null;
  message_count: number | null;
}

interface ThreadListResponse {
  threads: ThreadInfo[];
  total: number;
  limit: number;
  offset: number;
}

// Messages
interface Message {
  id: string | null;
  role: 'user' | 'assistant' | 'tool' | 'unknown';
  content: string;
  timestamp: string | null;
}

interface MessagesResponse {
  messages: Message[];
  thread_id: string;
  total: number;
  limit: number;
  offset: number;
}

// Chat
interface ChatRequest {
  message: string;
  thread_id?: string;
}

interface ChatResponse {
  response: string;
  thread_id: string;
  message_id: string | null;
  timestamp: string | null;
}

// Health
interface HealthResponse {
  status: string;
  agent_name: string;
}
```

---