import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { logger } from '../../common/logger';
import type { AIProvider, AIMessage, CompletionRequest, CompletionResponse, StreamChunk } from './types';
import { ProviderError } from './types';

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  readonly models: string[] = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'];
  private genAI: GoogleGenerativeAI;

  constructor(apiKey?: string) {
    if (!apiKey) {
      throw new ProviderError(
        'Gemini API key is not configured. Set GEMINI_API_KEY in environment.',
        this.name,
        401,
        'MISSING_API_KEY',
      );
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    const start = performance.now();
    const { model } = request;

    try {
      const geminiModel = this.getModel(model);
      const { systemInstruction, contents } = this.toGeminiFormat(request.messages);

      const result = await geminiModel.generateContent({
        contents,
        systemInstruction: systemInstruction ? { role: 'user', parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
          topP: request.topP,
          stopSequences: request.stop,
        },
      });

      const response = result.response;
      const latency = Math.round(performance.now() - start);
      const text = response.text();

      const usage = (response as any).usageMetadata;

      logger.info(
        { provider: this.name, model, latency },
        'Gemini completion generated',
      );

      return {
        content: text || null,
        model,
        provider: this.name,
        tokens: {
          prompt: usage?.promptTokenCount ?? 0,
          completion: usage?.candidatesTokenCount ?? 0,
          total: usage?.totalTokenCount ?? 0,
        },
        latency,
        finishReason: this.mapFinishReason(response.candidates?.[0]?.finishReason),
      };
    } catch (error: any) {
      logger.error({ err: error, provider: this.name, model }, 'Gemini completion failed');
      throw new ProviderError(
        error.message ?? 'Gemini completion failed',
        this.name,
        error.status ?? error.response?.status ?? 500,
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
      const geminiModel = this.getModel(model);
      const { systemInstruction, contents } = this.toGeminiFormat(request.messages);

      const result = await geminiModel.generateContentStream({
        contents,
        systemInstruction: systemInstruction ? { role: 'user', parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
          topP: request.topP,
          stopSequences: request.stop,
        },
      });

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          content += text;
          await onChunk({ type: 'content', content: text });
        }
      }

      const response = await result.response;
      const latency = Math.round(performance.now() - start);

      const usage = (response as any).usageMetadata;
      const finishReason = this.mapFinishReason(response.candidates?.[0]?.finishReason);

      await onChunk({
        type: 'done',
        finishReason,
        tokens: usage
          ? { prompt: usage.promptTokenCount ?? 0, completion: usage.candidatesTokenCount ?? 0, total: usage.totalTokenCount ?? 0 }
          : undefined,
      });

      logger.info(
        { provider: this.name, model, latency, contentLength: content.length },
        'Gemini streaming completed',
      );

      return {
        content,
        model,
        provider: this.name,
        tokens: {
          prompt: usage?.promptTokenCount ?? 0,
          completion: usage?.candidatesTokenCount ?? 0,
          total: usage?.totalTokenCount ?? 0,
        },
        latency,
        finishReason,
      };
    } catch (error: any) {
      logger.error({ err: error, provider: this.name, model }, 'Gemini streaming failed');
      await onChunk({ type: 'error', error: error.message ?? 'Gemini streaming failed' });
      throw new ProviderError(
        error.message ?? 'Gemini streaming failed',
        this.name,
        error.status ?? error.response?.status ?? 500,
        error.code,
      );
    }
  }

  private getModel(model: string): GenerativeModel {
    return this.genAI.getGenerativeModel({ model });
  }

  private toGeminiFormat(messages: AIMessage[]): {
    systemInstruction: string | undefined;
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  } {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const systemInstruction = systemMessages.map((m) => m.content).join('\n') || undefined;

    const otherMessages = messages.filter((m) => m.role !== 'system');

    const contents = otherMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    return { systemInstruction, contents };
  }

  private mapFinishReason(reason: unknown): string | undefined {
    if (reason === null || reason === undefined) return undefined;
    const value = Number(reason);
    const mapping: Record<number, string> = {
      1: 'stop',
      2: 'max_tokens',
      3: 'safety',
      4: 'recitation',
      5: 'other',
    };
    return mapping[value] ?? `unknown_${value}`;
  }
}
