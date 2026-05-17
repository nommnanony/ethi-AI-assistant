import OpenAI from 'openai';
import { logger } from '../../common/logger';
import type { AIProvider, CompletionRequest, CompletionResponse, StreamChunk } from './types';
import { ProviderError } from './types';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export class OpenRouterProvider implements AIProvider {
  readonly name = 'openrouter';
  readonly models: string[] = ['openrouter/auto'];
  private client: OpenAI;

  constructor(apiKey?: string) {
    if (!apiKey) {
      throw new ProviderError(
        'OpenRouter API key is not configured. Set OPENROUTER_API_KEY in environment.',
        this.name,
        401,
        'MISSING_API_KEY',
      );
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: OPENROUTER_BASE_URL,
      defaultHeaders: {
        'HTTP-Referer': process.env.APP_URL ?? 'http://localhost:3001',
        'X-Title': process.env.APP_NAME ?? 'Ethi AI',
      },
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
        tools: request.tools as OpenAI.Chat.ChatCompletionTool[] | undefined,
        tool_choice: request.tool_choice as OpenAI.Chat.ChatCompletionToolChoiceOption | undefined,
        user: request.user,
      }).catch((err: any) => {
        logger.error({ err: err.message, status: err.status, model }, 'OpenRouter API error');
        throw err;
      });

      const choice = response.choices?.[0];
      const latency = Math.round(performance.now() - start);

      if (!choice) {
        logger.error({ response }, 'OpenRouter returned no choices');
        throw new Error('OpenRouter returned no response choices');
      }

      logger.info(
        { provider: this.name, model, latency, tokens: response.usage?.total_tokens },
        'OpenRouter completion generated',
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
      logger.error({ err: error.message, stack: error.stack, provider: this.name, model }, 'OpenRouter completion failed');
      throw new ProviderError(
        error.message ?? 'OpenRouter completion failed',
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
        tools: request.tools as OpenAI.Chat.ChatCompletionTool[] | undefined,
        tool_choice: request.tool_choice as OpenAI.Chat.ChatCompletionToolChoiceOption | undefined,
        user: request.user,
        stream: true,
        stream_options: { include_usage: true },
      });

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          content += delta;
          await onChunk({ type: 'content', content: delta });
        }

        const finishReason = chunk.choices?.[0]?.finish_reason;
        if (finishReason) {
          const usage = chunk.usage;
          await onChunk({
            type: 'done',
            finishReason,
            tokens: usage
              ? { prompt: usage.prompt_tokens ?? 0, completion: usage.completion_tokens ?? 0, total: usage.total_tokens ?? 0 }
              : undefined,
          });
        }
      }

      const latency = Math.round(performance.now() - start);
      logger.info(
        { provider: this.name, model, latency, contentLength: content.length },
        'OpenRouter streaming completed',
      );

      return {
        content,
        model,
        provider: this.name,
        tokens: { prompt: 0, completion: 0, total: 0 },
        latency,
      };
    } catch (error: any) {
      logger.error({ err: error, provider: this.name, model }, 'OpenRouter streaming failed');
      await onChunk({ type: 'error', error: error.message ?? 'OpenRouter streaming failed' });
      throw new ProviderError(
        error.message ?? 'OpenRouter streaming failed',
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
