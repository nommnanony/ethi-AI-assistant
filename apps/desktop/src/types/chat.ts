export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  code?: string;
  tools?: string[];
  timestamp: number;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  model?: string;
  provider?: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  duration?: number;
  error?: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
  agent?: Agent;
}

export interface Agent {
  id: string;
  name: string;
  color: string;
  description?: string;
  systemPrompt?: string;
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  icon: string;
  url?: string;
  apiKey?: string;
}

export interface ChatRequest {
  message: string;
  model: string;
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  context?: Message[];
  systemPrompt?: string;
}

export interface ChatResponse {
  response: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
