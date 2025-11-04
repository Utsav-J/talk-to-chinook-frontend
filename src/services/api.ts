import { API_BASE_URL } from '../config';
import type {
  ThreadInfo,
  ThreadListResponse,
  Message,
  MessagesResponse,
  ChatRequest,
  ChatResponse,
  HealthResponse,
  DeleteThreadResponse,
  ApiError,
} from '../types/api';

class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string
  ) {
    super(detail);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorDetail = 'Request failed';
    try {
      const error: ApiError = await response.json();
      errorDetail = error.detail || errorDetail;
    } catch {
      errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new ApiError(response.status, errorDetail);
  }
  return response.json();
}

export class ChinookAgentAPI {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  async healthCheck(): Promise<HealthResponse> {
    const response = await fetch(`${this.baseURL}/health`);
    return handleResponse<HealthResponse>(response);
  }

  async createThread(title?: string, threadId?: string): Promise<ThreadInfo> {
    const response = await fetch(`${this.baseURL}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, thread_id: threadId }),
    });
    return handleResponse<ThreadInfo>(response);
  }

  async listThreads(limit = 20, offset = 0): Promise<ThreadListResponse> {
    const response = await fetch(
      `${this.baseURL}/threads?limit=${limit}&offset=${offset}`
    );
    return handleResponse<ThreadListResponse>(response);
  }

  async getThread(threadId: string): Promise<ThreadInfo> {
    const response = await fetch(`${this.baseURL}/threads/${threadId}`);
    return handleResponse<ThreadInfo>(response);
  }

  async getMessages(
    threadId: string,
    limit = 50,
    offset = 0
  ): Promise<MessagesResponse> {
    const response = await fetch(
      `${this.baseURL}/threads/${threadId}/messages?limit=${limit}&offset=${offset}`
    );
    return handleResponse<MessagesResponse>(response);
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
    return handleResponse<ChatResponse>(response);
  }

  async deleteThread(threadId: string): Promise<DeleteThreadResponse> {
    const response = await fetch(`${this.baseURL}/threads/${threadId}`, {
      method: 'DELETE',
    });
    return handleResponse<DeleteThreadResponse>(response);
  }
}

export const api = new ChinookAgentAPI();
export { ApiError };

