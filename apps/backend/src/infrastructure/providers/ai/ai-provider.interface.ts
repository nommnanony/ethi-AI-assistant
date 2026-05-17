import type { CompletionRequest, CompletionResponse, StreamChunk, ModelInfo } from './types';

export interface AIProvider {
  /**
   * Generate a completion from the provider
   */
  generateCompletion(request: CompletionRequest): Promise<CompletionResponse>;

  /**
   * Generate a streaming completion from the provider
   */
  generateStreaming(request: CompletionRequest, onChunk: (chunk: StreamChunk) => void): Promise<CompletionResponse>;

  /**
   * Check the health of the provider
   */
  getHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; latencyMs: number }>;

  /**
   * Get available models for this provider
   */
  getAvailableModels(): Promise<ModelInfo[]>;

  /**
   * Get the provider name
   */
  getProviderName(): string;
}
