// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  health: '/health',
  threads: '/threads',
  chat: '/chat',
} as const;

