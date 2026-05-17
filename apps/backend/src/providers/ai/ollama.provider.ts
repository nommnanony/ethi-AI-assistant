import OpenAI from 'openai';
import { logger } from '../../common/logger';
import type { AIProvider, CompletionRequest, CompletionResponse, StreamChunk } from './types';
import { ProviderError } from './types';

const OLLAMA_BASE_URL = 'http://localhost:11434/v1';

export class OllamaProvider implements AIProvider {
  readonly name = 'ollama';
  readonly models: string[] = ['ollama/custom'];
  private client: OpenAI;

  constructor(baseURL: string = OLLAMA_BASE_URL) {
    this.client = new OpenAI({
      apiKey: 'ollama',
      baseURL,
    });
  }

  async generateCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    const start = performance.now();
    const { model } = request;

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: this.mapMessages(request.messages),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        top_p: request.topP,
        stop: request.stop ?? undefined,
        stream: false,
      });

      const choice = response.choices?.[0];
      const latency = Math.round(performance.now() - start);

      logger.info(
        { provider: this.name, model, latency },
        'Ollama completion generated',
      );

      return {
        content: choice?.message?.content ?? null,
        model: response.model,
        provider: this.name,
        tokens: {
          prompt: response.usage?.prompt_tokens ?? 0,
          completion: response.usage?.completion_tokens ?? 0,
          total: response.usage?.total_tokens ?? 0,
        },
        latency,
        finishReason: choice?.finish_reason ?? undefined,
      };
    } catch (error: any) {
      logger.error({ err: error, provider: this.name, model }, 'Ollama completion failed');
      throw new ProviderError(
        error.message ?? 'Ollama completion failed',
        this.name,
        error.status ?? 500,
        error.code,
      );
    }
  }

  async generateStreaming(
    request: CompletionRequest,
    onChunk: (chunk: StreamChunk) => Promise<void> | void,
  ): Promise<CompletionResponse> {
    const start = performance.now();
    const { model } = request;
    let content = '';

    try {
      const stream = await this.client.chat.completions.create({
        model,
        messages: this.mapMessages(request.messages),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        top_p: request.topP,
        stop: request.stop ?? undefined,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          content += delta;
          await onChunk({ type: 'content', content: delta });
        }

        const finishReason = chunk.choices?.[0]?.finish_reason;
        if (finishReason) {
          await onChunk({ type: 'done', finishReason });
        }
      }

      const latency = Math.round(performance.now() - start);
      logger.info(
        { provider: this.name, model, latency, contentLength: content.length },
        'Ollama streaming completed',
      );

      return {
        content,
        model,
        provider: this.name,
        tokens: { prompt: 0, completion: 0, total: 0 },
        latency,
      };
    } catch (error: any) {
      logger.error({ err: error, provider: this.name, model }, 'Ollama streaming failed');
      await onChunk({ type: 'error', error: error.message ?? 'Ollama streaming failed' });
      throw new ProviderError(
        error.message ?? 'Ollama streaming failed',
        this.name,
        error.status ?? 500,
        error.code,
      );
    }
  }

  private mapMessages(
    messages: CompletionRequest['messages'],
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map((msg) => {
      const base: Record<string, unknown> = { role: msg.role, content: msg.content };
      if (msg.name) base.name = msg.name;
      if (msg.tool_call_id) base.tool_call_id = msg.tool_call_id;
      if (msg.tool_calls) base.tool_calls = msg.tool_calls;
      return base as unknown as OpenAI.Chat.ChatCompletionMessageParam;
    });
  }
}
