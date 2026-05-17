import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../common/logger';
import type { AIProvider, AIMessage, CompletionRequest, CompletionResponse, StreamChunk } from './types';
import { ProviderError } from './types';

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  readonly models: string[] = ['claude-sonnet-4', 'claude-opus-4', 'claude-haiku-3.5'];
  private client: Anthropic;

  constructor(apiKey?: string) {
    if (!apiKey) {
      throw new ProviderError(
        'Anthropic API key is not configured. Set ANTHROPIC_API_KEY in environment.',
        this.name,
        401,
        'MISSING_API_KEY',
      );
    }
    this.client = new Anthropic({ apiKey });
  }

  async generateCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    const start = performance.now();
    const { model } = request;

    try {
      const { system, messages } = this.splitSystemMessages(request.messages);

      const response = await this.client.messages.create({
        model,
        max_tokens: request.maxTokens ?? 4096,
        messages: messages as Anthropic.MessageParam[],
        system: system || undefined,
        temperature: request.temperature,
        top_p: request.topP,
        stop_sequences: request.stop,
        tools: request.tools
          ? request.tools.map((t) => ({
              name: t.function.name,
              description: t.function.description,
              input_schema: t.function.parameters as Anthropic.Tool.InputSchema,
            }))
          : undefined,
      });

      const latency = Math.round(performance.now() - start);
      const content = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as Anthropic.TextBlock).text)
        .join('');

      logger.info(
        { provider: this.name, model, latency, tokens: response.usage?.input_tokens + (response.usage?.output_tokens ?? 0) },
        'Anthropic completion generated',
      );

      return {
        content,
        model: response.model,
        provider: this.name,
        tokens: {
          prompt: response.usage?.input_tokens ?? 0,
          completion: response.usage?.output_tokens ?? 0,
          total: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
        },
        latency,
        finishReason: response.stop_reason ?? undefined,
      };
    } catch (error: any) {
      logger.error({ err: error, provider: this.name, model }, 'Anthropic completion failed');
      throw new ProviderError(
        error.message ?? 'Anthropic completion failed',
        this.name,
        error.status ?? 500,
        error.error?.type,
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
      const { system, messages } = this.splitSystemMessages(request.messages);

      const stream = this.client.messages.stream({
        model,
        max_tokens: request.maxTokens ?? 4096,
        messages: messages as Anthropic.MessageParam[],
        system: system || undefined,
        temperature: request.temperature,
        top_p: request.topP,
        stop_sequences: request.stop,
        tools: request.tools
          ? request.tools.map((t) => ({
              name: t.function.name,
              description: t.function.description,
              input_schema: t.function.parameters as Anthropic.Tool.InputSchema,
            }))
          : undefined,
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          const text = event.delta.text ?? '';
          if (text) {
            content += text;
            await onChunk({ type: 'content', content: text });
          }
        }
      }

      const finalMessage = await stream.finalMessage();
      const latency = Math.round(performance.now() - start);

      await onChunk({
        type: 'done',
        finishReason: finalMessage.stop_reason ?? undefined,
        tokens: {
          prompt: finalMessage.usage?.input_tokens ?? 0,
          completion: finalMessage.usage?.output_tokens ?? 0,
          total: (finalMessage.usage?.input_tokens ?? 0) + (finalMessage.usage?.output_tokens ?? 0),
        },
      });

      logger.info(
        { provider: this.name, model, latency, contentLength: content.length },
        'Anthropic streaming completed',
      );

      return {
        content,
        model: finalMessage.model,
        provider: this.name,
        tokens: {
          prompt: finalMessage.usage?.input_tokens ?? 0,
          completion: finalMessage.usage?.output_tokens ?? 0,
          total: (finalMessage.usage?.input_tokens ?? 0) + (finalMessage.usage?.output_tokens ?? 0),
        },
        latency,
        finishReason: finalMessage.stop_reason ?? undefined,
      };
    } catch (error: any) {
      logger.error({ err: error, provider: this.name, model }, 'Anthropic streaming failed');
      await onChunk({ type: 'error', error: error.message ?? 'Anthropic streaming failed' });
      throw new ProviderError(
        error.message ?? 'Anthropic streaming failed',
        this.name,
        error.status ?? 500,
        error.error?.type,
      );
    }
  }

  private splitSystemMessages(messages: AIMessage[]): {
    system: string | undefined;
    messages: AIMessage[];
  } {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const otherMessages = messages.filter((m) => m.role !== 'system');

    return {
      system: systemMessages.map((m) => m.content).join('\n') || undefined,
      messages: otherMessages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    };
  }
}
