import type { ModelInfo } from './types';

const MODELS: ModelInfo[] = [
  { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o', contextWindow: 128000, maxTokens: 4096, pricing: { input: 2.5, output: 10 }, capabilities: ['chat', 'vision', 'tools', 'streaming'] },
  { id: 'gpt-4-turbo', provider: 'openai', name: 'GPT-4 Turbo', contextWindow: 128000, maxTokens: 4096, pricing: { input: 10, output: 30 }, capabilities: ['chat', 'vision', 'tools', 'streaming'] },
  { id: 'gpt-3.5-turbo', provider: 'openai', name: 'GPT-3.5 Turbo', contextWindow: 16385, maxTokens: 4096, pricing: { input: 0.5, output: 1.5 }, capabilities: ['chat', 'tools', 'streaming'] },
  { id: 'claude-opus-4', provider: 'anthropic', name: 'Claude Opus 4', contextWindow: 200000, maxTokens: 4096, pricing: { input: 15, output: 75 }, capabilities: ['chat', 'vision', 'tools', 'streaming'] },
  { id: 'claude-sonnet-4', provider: 'anthropic', name: 'Claude Sonnet 4', contextWindow: 200000, maxTokens: 4096, pricing: { input: 3, output: 15 }, capabilities: ['chat', 'vision', 'tools', 'streaming'] },
  { id: 'claude-haiku-3.5', provider: 'anthropic', name: 'Claude Haiku 3.5', contextWindow: 200000, maxTokens: 4096, pricing: { input: 0.8, output: 4 }, capabilities: ['chat', 'tools', 'streaming'] },
  { id: 'gemini-2.5-pro', provider: 'gemini', name: 'Gemini 2.5 Pro', contextWindow: 1048576, maxTokens: 8192, pricing: { input: 1.25, output: 10 }, capabilities: ['chat', 'vision', 'tools', 'streaming'] },
  { id: 'gemini-2.5-flash', provider: 'gemini', name: 'Gemini 2.5 Flash', contextWindow: 1048576, maxTokens: 8192, pricing: { input: 0.075, output: 0.3 }, capabilities: ['chat', 'vision', 'tools', 'streaming'] },
  { id: 'gemini-2.0-flash', provider: 'gemini', name: 'Gemini 2.0 Flash', contextWindow: 1048576, maxTokens: 8192, pricing: { input: 0.1, output: 0.4 }, capabilities: ['chat', 'vision', 'tools', 'streaming'] },
  { id: 'llama-3.3-70b', provider: 'groq', name: 'Llama 3.3 70B', contextWindow: 32768, maxTokens: 4096, pricing: { input: 0.59, output: 0.79 }, capabilities: ['chat', 'streaming'] },
  { id: 'mixtral-8x7b', provider: 'groq', name: 'Mixtral 8x7B', contextWindow: 32768, maxTokens: 4096, pricing: { input: 0.24, output: 0.24 }, capabilities: ['chat', 'streaming'] },
  { id: 'openrouter/auto', provider: 'openrouter', name: 'OpenRouter Auto', contextWindow: 128000, maxTokens: 4096, pricing: { input: 0, output: 0 }, capabilities: ['chat', 'streaming'], isHidden: true },
  { id: 'ollama/custom', provider: 'ollama', name: 'Ollama Custom', contextWindow: 8192, maxTokens: 4096, pricing: { input: 0, output: 0 }, capabilities: ['chat', 'streaming'], isHidden: true },
  { id: 'qwen2.5-coder:3b', provider: 'ollama', name: 'Qwen 2.5 Coder 3B', contextWindow: 32768, maxTokens: 4096, pricing: { input: 0, output: 0 }, capabilities: ['chat', 'streaming'] },
  { id: 'nomic-embed-text', provider: 'ollama', name: 'Nomic Embed Text', contextWindow: 8192, maxTokens: 4096, pricing: { input: 0, output: 0 }, capabilities: ['embedding'] },
];

export class ModelRegistry {
  private models: Map<string, ModelInfo> = new Map();

  constructor() {
    MODELS.forEach(m => this.models.set(m.id, m));
  }

  getModel(modelId: string): ModelInfo | undefined {
    return this.models.get(modelId);
  }

  getModelsByProvider(provider: string): ModelInfo[] {
    return Array.from(this.models.values()).filter(m => m.provider === provider && !m.isHidden);
  }

  getAllModels(): ModelInfo[] {
    return Array.from(this.models.values()).filter(m => !m.isHidden);
  }

  getVisibleModels(): ModelInfo[] {
    return Array.from(this.models.values()).filter(m => !m.isHidden);
  }

  registerModel(model: ModelInfo): void {
    this.models.set(model.id, model);
  }

  supportsCapability(modelId: string, capability: string): boolean {
    return this.models.get(modelId)?.capabilities.includes(capability) ?? false;
  }

  getDefaultModelsForProvider(provider: string): string[] {
    return this.getModelsByProvider(provider).map(m => m.id);
  }

  getFallbackModel(provider: string): string | undefined {
    const models = this.getModelsByProvider(provider);
    return models.length > 0 ? models[0]!.id : undefined;
  }

  supportsStreaming(modelId: string): boolean {
    return this.supportsCapability(modelId, 'streaming');
  }

  estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const model = this.models.get(modelId);
    if (!model) return 0;
    return (inputTokens * model.pricing.input + outputTokens * model.pricing.output) / 1_000_000;
  }
}

export const modelRegistry = new ModelRegistry();
