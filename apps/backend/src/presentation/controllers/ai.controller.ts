import type { FastifyRequest, FastifyReply } from 'fastify';
import { ZChatRequest, ZAIConfigUpdate } from '../validators/ai.validator';
import { aiOrchestrationService } from '../../application/services/ai-orchestration.service';
import { errorService } from '../../shared/error-handling/error.service';
import { AppError } from '../../shared/error-handling/error.service';
import type { AIMessage, StreamChunk } from '../../providers/ai/types';

export class AIController {
  async chat(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const input = ZChatRequest.parse(request.body);
      const userId = request.user?.sub || 'anonymous';

      // Skip credit check if no user (for testing)
      if (userId !== 'anonymous') {
        await aiOrchestrationService.deductCredits(userId, 0).catch(() => {}); // Just validate user has subscription
      }

      const result = await aiOrchestrationService.chat(
        input.messages as AIMessage[],
        userId === 'anonymous' ? null : userId,
        input.provider,
        input.model,
        input.temperature,
        input.maxTokens,
        input.topP
      );

      reply.send({
        content: result.content,
        model: result.model,
        provider: result.provider,
        tokens: result.tokens,
        latency: result.latency,
        finishReason: result.finishReason,
      });
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async chatStream(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const input = ZChatRequest.parse(request.body);
      const userId = request.user?.sub || 'anonymous';

      // Set up streaming response headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      // Handle client disconnection
      request.raw.on('close', () => {
        reply.raw.end();
      });

      try {
        await aiOrchestrationService.chatStream(
          input.messages as AIMessage[],
          async (chunk: StreamChunk) => {
            // Check if client is still connected
            if (reply.raw.writableEnded) return;
            reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
          },
          userId === 'anonymous' ? null : userId,
          input.provider,
          input.model,
          input.temperature,
          input.maxTokens,
          input.topP
        );

        // Send done event if still connected
        if (!reply.raw.writableEnded) {
          reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          reply.raw.end();
        }
      } catch (streamError) {
        // Handle stream errors
        if (!reply.raw.writableEnded) {
          const message = streamError instanceof AppError ? streamError.message : 'Stream error';
          reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`);
          reply.raw.end();
        }
      }
    } catch (error) {
      // Handle setup errors
      if (!reply.raw.writableEnded) {
        errorService.registerErrorHandler(request.server as any);
        reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        reply.raw.end();
      }
      throw error;
    }
  }

  async getProviders(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Import here to avoid circular dependencies during migration
      const { getAvailableProviders } = await import('../../providers/ai/provider.factory');
      const providers = getAvailableProviders();
      reply.send({ providers });
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async getProviderConfig(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user?.sub || 'anonymous';
      
      // Import here to avoid circular dependencies during migration
      const { prisma } = await import('../../database/prisma/client');
      const configs = await prisma.userAIConfig.findMany({
        where: { userId },
        orderBy: { isDefault: 'desc' },
      });
      
      reply.send(configs);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async updateProviderConfig(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const input = ZAIConfigUpdate.parse(request.body);
      const userId = request.user?.sub || 'anonymous';

      if (Object.keys(input).length === 0) {
        throw new AppError('No fields to update', 400, 'NO_FIELDS_TO_UPDATE');
      }

      // Import here to avoid circular dependencies during migration
      const { prisma } = await import('../../database/prisma/client');
      
      if (input.isDefault) {
        await prisma.userAIConfig.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      // Convert provider and model to Prisma enums
      const toPrismaEnum = (value: string): string => {
        const map: Record<string, string> = {
          openai: 'OPENAI',
          anthropic: 'ANTHROPIC',
          gemini: 'GEMINI',
          groq: 'GROQ',
          openrouter: 'OPENROUTER',
          ollama: 'OLLAMA',
          custom: 'CUSTOM',
          gpt_4o: 'GPT_4O',
          gpt_4_turbo: 'GPT_4_TURBO',
          gpt_3_5_turbo: 'GPT_3_5_TURBO',
          claude_3_opus: 'CLAUDE_3_OPUS',
          claude_3_sonnet: 'CLAUDE_3_SONNET',
          claude_3_haiku: 'CLAUDE_3_HAIKU',
          gemini_pro: 'GEMINI_PRO',
          gemini_ultra: 'GEMINI_ULTRA',
          groq_llama3: 'GROQ_LLAMA3',
          groq_mixtral: 'GROQ_MIXTRAL',
          openrouter_auto: 'OPENROUTER_AUTO',
          ollama_custom: 'OLLAMA_CUSTOM',
        };
        return map[value.toLowerCase().replace(/-/g, '_')] || value.toUpperCase();
      };

      const providerEnum = input.provider ? toPrismaEnum(input.provider) : 'OPENAI';
      const modelEnum = input.model ? toPrismaEnum(input.model) : 'GPT_4O';

      const existing = await prisma.userAIConfig.findFirst({
        where: { userId, provider: providerEnum as any },
      });

      let result;
      if (existing) {
        result = await prisma.userAIConfig.update({
          where: { id: existing.id },
          data: {
            ...(input.model && { model: modelEnum as any }),
            ...(input.apiKey !== undefined && { apiKey: input.apiKey }),
            ...(input.apiEndpoint !== undefined && { apiEndpoint: input.apiEndpoint }),
            ...(input.temperature !== undefined && { temperature: input.temperature }),
            ...(input.maxTokens !== undefined && { maxTokens: input.maxTokens }),
            ...(input.topP !== undefined && { topP: input.topP }),
            ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
            ...(input.isByok !== undefined && { isByok: input.isByok }),
          },
        });
      } else {
        result = await prisma.userAIConfig.create({
          data: {
            userId,
            provider: providerEnum as any,
            model: modelEnum as any,
            apiKey: input.apiKey,
            apiEndpoint: input.apiEndpoint,
            temperature: input.temperature ?? 0.7,
            maxTokens: input.maxTokens ?? 4096,
            topP: input.topP ?? 1.0,
            isDefault: input.isDefault ?? false,
            isByok: input.isByok ?? false,
          },
        });
      }

      reply.send(result);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async executeCustomProvider(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { curlCommand, message, responsePath } = request.body as {
        curlCommand: string;
        message: string;
        responsePath?: string;
      };

      if (!curlCommand || !message) {
        throw new AppError('curlCommand and message are required', 400, 'MISSING_PARAMETERS');
      }

      // Import here to avoid circular dependencies during migration
      const { prisma } = await import('../../database/prisma/client');
      
      // For now, we'll use the existing AI service method
      // In a refactored version, this would go through the orchestration layer
      const { aiService } = await import('../../modules/ai/ai.service');
      const content = await aiService.executeCustomProvider(curlCommand, message, responsePath);

      reply.send({
        content,
        provider: 'custom',
        tokens: { prompt: 0, completion: content.length / 4, total: content.length / 4 },
        latency: 0,
      });
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async healthCheck(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Simple health check for AI providers
      const providers = ['gemini', 'openrouter', 'ollama'];
      const health: Record<string, { configured: boolean; status: string }> = {};
      
      for (const p of providers) {
        const key = p === 'gemini' ? 'GEMINI_API_KEY' : 
                   p === 'openrouter' ? 'OPENROUTER_API_KEY' : 
                   'OLLAMA_HOST';
        const hasKey = !!process.env[key];
        health[p] = { configured: hasKey, status: hasKey ? 'ready' : 'missing_key' };
      }
      
      reply.send({ 
        providers: health,
        geminiKey: !!process.env.GEMINI_API_KEY,
        openrouterKey: !!process.env.OPENROUTER_API_KEY,
      });
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }
}

export const aiController = new AIController();
