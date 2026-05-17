import { config } from '../../config/env';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { GeminiProvider } from './gemini.provider';
import { GroqProvider } from './groq.provider';
import { OpenRouterProvider } from './openrouter.provider';
import { OllamaProvider } from './ollama.provider';
import type { AIProvider, CompletionRequest, CompletionResponse, ModelInfo as ModelInfoType } from './types';
import { ProviderError, ProviderRateLimitError } from './types';
import { modelRegistry } from './model-registry';
import { logger } from '../../common/logger';

interface ProviderEntry {
  factory: (apiKey?: string) => AIProvider;
  defaultModel: string;
  requiresKey: boolean;
}

const providerDefinitions: Record<string, ProviderEntry> = {
  openai: { factory: (key) => new OpenAIProvider(key), defaultModel: 'gpt-4o', requiresKey: true },
  anthropic: { factory: (key) => new AnthropicProvider(key), defaultModel: 'claude-sonnet-4', requiresKey: true },
  gemini: { factory: (key) => new GeminiProvider(key), defaultModel: 'gemini-2.5-flash', requiresKey: true },
  groq: { factory: (key) => new GroqProvider(key), defaultModel: 'llama-3.3-70b', requiresKey: true },
  openrouter: { factory: (key) => new OpenRouterProvider(key), defaultModel: 'openrouter/auto', requiresKey: true },
  ollama: { factory: () => new OllamaProvider(), defaultModel: 'ollama/custom', requiresKey: false },
};

const MAX_RETRIES = 2;

export function createProvider(name: string, apiKey?: string): AIProvider {
  const key = name.toLowerCase();
  const def = providerDefinitions[key];
  if (!def) throw new ProviderError(`Unknown provider: "${name}"`, name, 400, 'UNKNOWN_PROVIDER');
  return def.factory(apiKey);
}

export async function generateWithFallback(
  request: CompletionRequest,
  preferredProvider?: string,
  userApiKey?: string,
): Promise<CompletionResponse> {
  const providers = preferredProvider
    ? [preferredProvider, ...Object.keys(providerDefinitions).filter(p => p !== preferredProvider)]
    : Object.keys(providerDefinitions);

  let lastError: Error | null = null;

  for (const providerName of providers) {
    try {
      const provider = createProvider(providerName, userApiKey);
      const modelKey = request.model || modelRegistry.getDefaultModelsForProvider(providerName)[0] || '';
      const model = modelRegistry.getModel(modelKey);

      if (!model || model.provider !== providerName) {
        const fallbackModel = modelRegistry.getFallbackModel(providerName);
        if (!fallbackModel) continue;
        request = { ...request, model: fallbackModel };
      }

      return await retryWithExponentialBackoff(() => provider.generateCompletion(request), providerName);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn({ err: lastError, provider: providerName }, 'Provider failed, trying fallback');
    }
  }

  throw lastError ?? new ProviderError('All providers failed', 'all', 503, 'ALL_PROVIDERS_FAILED');
}

export async function generateStreamingWithFallback(
  request: CompletionRequest,
  onChunk: (chunk: import('./types').StreamChunk) => void | Promise<void>,
  preferredProvider?: string,
  userApiKey?: string,
): Promise<CompletionResponse> {
  const providers = preferredProvider
    ? [preferredProvider, ...Object.keys(providerDefinitions).filter(p => p !== preferredProvider)]
    : Object.keys(providerDefinitions);

  let lastError: Error | null = null;

  for (const providerName of providers) {
    try {
      const provider = createProvider(providerName, userApiKey);
      return await retryWithExponentialBackoff(() => provider.generateStreaming(request, onChunk), providerName);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn({ err: lastError, provider: providerName }, 'Streaming provider failed, trying fallback');
    }
  }

  throw lastError ?? new ProviderError('All providers failed for streaming', 'all', 503, 'ALL_PROVIDERS_FAILED');
}

async function retryWithExponentialBackoff<T>(fn: () => Promise<T>, provider: string): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ProviderRateLimitError) {
        const wait = (err.retryAfter ?? (attempt + 1) * 1000);
        logger.warn({ provider, attempt, wait }, 'Rate limited, retrying');
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (attempt < MAX_RETRIES && err instanceof Error) {
        const wait = Math.pow(2, attempt) * 1000;
        logger.warn({ provider, attempt, wait }, 'Provider error, retrying');
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  throw new ProviderError(`Max retries exceeded for ${provider}`, provider, 503, 'MAX_RETRIES_EXCEEDED');
}

export function getAvailableProviders(byokKeys?: Record<string, string>): string[] {
  return Object.entries(providerDefinitions).filter(([name, def]) => {
    if (!def.requiresKey) return true;
    const key = byokKeys?.[name] ?? getEnvKey(name);
    return !!key;
  }).map(([name]) => name);
}

function getEnvKey(provider: string): string | undefined {
  const map: Record<string, string | undefined> = {
    openai: config.OPENAI_API_KEY,
    anthropic: config.ANTHROPIC_API_KEY,
    gemini: config.GEMINI_API_KEY,
    groq: config.GROQ_API_KEY,
    openrouter: config.OPENROUTER_API_KEY,
  };
  return map[provider];
}

export function getDefaultModel(provider: string): string | undefined {
  return providerDefinitions[provider]?.defaultModel;
}

export { modelRegistry };
