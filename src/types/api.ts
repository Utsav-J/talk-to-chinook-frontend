// API Types based on API_USAGE.md

export interface ThreadInfo {
  thread_id: string;
  created_at: string | null;
  last_activity: string | null;
  title: string | null;
  message_count: number | null;
}

export interface ThreadListResponse {
  threads: ThreadInfo[];
  total: number;
  limit: number;
  offset: number;
}

export interface ToolCallInfo {
  tool_name: string;
  args: Record<string, any>;
  tool_call_id: string;
  output: string | null;
}

export interface AgentDebugInfo {
  step_count: number;
  tool_calls: ToolCallInfo[];
  model_name: string | null;
}

export interface Message {
  id: string | null;
  role: 'user' | 'assistant' | 'tool' | 'unknown';
  content: string;
  timestamp: string | null;
  debug_info?: AgentDebugInfo | null;
}

export interface MessagesResponse {
  messages: Message[];
  thread_id: string;
  total: number;
  limit: number;
  offset: number;
}

export interface ChatRequest {
  message: string;
  thread_id?: string;
}

export interface ChatResponse {
  response: string;
  thread_id: string;
  message_id: string | null;
  timestamp: string | null;
  debug_info: AgentDebugInfo | null;
}

export interface HealthResponse {
  status: string;
  agent_name: string;
}

export interface DeleteThreadResponse {
  thread_id: string;
  status: string;
  message: string;
}

export interface ApiError {
  detail: string;
}

