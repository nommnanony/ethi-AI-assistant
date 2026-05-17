export type AIProviderType = 'OPENAI' | 'ANTHROPIC' | 'GEMINI' | 'GROQ' | 'OPENROUTER' | 'OLLAMA' | 'CUSTOM';

export type AIModelType =
  | 'GPT_4O'
  | 'GPT_4_TURBO'
  | 'GPT_3_5_TURBO'
  | 'CLAUDE_3_OPUS'
  | 'CLAUDE_3_SONNET'
  | 'CLAUDE_3_HAIKU'
  | 'GEMINI_PRO'
  | 'GEMINI_ULTRA'
  | 'GROQ_LLAMA3'
  | 'GROQ_MIXTRAL'
  | 'OPENROUTER_AUTO'
  | 'OLLAMA_CUSTOM';

export interface AIProviderConfig {
  provider: AIProviderType;
  model: AIModelType;
  apiKey?: string;
  apiEndpoint?: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  isDefault: boolean;
  isByok: boolean;
}

export interface AICompletionRequest {
  messages: ChatMessage[];
  provider?: AIProviderType;
  model?: AIModelType;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AICompletionResponse {
  content: string;
  model: string;
  provider: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  latency: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens?: number;
  model?: string;
  latency?: number;
  createdAt: string;
}

export interface StreamChunk {
  type: 'chunk' | 'done' | 'error';
  content?: string;
  error?: string;
  final?: AICompletionResponse;
}
