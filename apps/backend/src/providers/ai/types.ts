export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
}

export interface CompletionRequest {
  messages: AIMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  stop?: string[];
  tools?: Array<{ type: 'function'; function: { name: string; description?: string; parameters: Record<string, unknown> } }>;
  tool_choice?: 'auto' | 'any' | 'none' | { type: 'function'; function: { name: string } };
  user?: string;
}

export interface CompletionResponse {
  content: string | null;
  model: string;
  provider: string;
  tokens: { prompt: number; completion: number; total: number };
  latency: number;
  finishReason?: string;
  cost?: number;
}

export interface StreamChunk {
  type: 'content' | 'error' | 'done';
  content?: string;
  error?: string;
  finishReason?: string;
  tokens?: { prompt: number; completion: number; total: number };
}

export class ProviderError extends Error {
  constructor(message: string, public readonly provider: string, public readonly statusCode: number = 500, public readonly code?: string) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class ProviderRateLimitError extends ProviderError {
  constructor(provider: string, public retryAfter?: number) {
    super(`Rate limited by ${provider}`, provider, 429, 'RATE_LIMITED');
    this.name = 'ProviderRateLimitError';
  }
}

export interface AIProvider {
  readonly name: string;
  readonly models: string[];
  generateCompletion(request: CompletionRequest): Promise<CompletionResponse>;
  generateStreaming(request: CompletionRequest, onChunk: (chunk: StreamChunk) => Promise<void> | void): Promise<CompletionResponse>;
}

export interface ModelInfo {
  id: string;
  provider: string;
  name: string;
  contextWindow: number;
  maxTokens: number;
  pricing: { input: number; output: number };
  capabilities: string[];
  isHidden?: boolean;
}

export interface ProviderConfig {
  name: string;
  apiKey?: string;
  apiEndpoint?: string;
  models: string[];
  isAvailable: boolean;
  requiresKey: boolean;
  supportsStreaming: boolean;
}
