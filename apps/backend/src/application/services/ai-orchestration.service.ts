import { logger } from '../../shared/logger/logger.service';
import { errorService } from '../../shared/error-handling/error.service';
import { AppError } from '../../shared/error-handling/error.service';
import { prisma } from '../../database/prisma/client';
import { aiQueue, redisConnection } from '../../infrastructure/queues/queue';
import type { AIMessage, CompletionRequest, CompletionResponse, StreamChunk } from '../../providers/ai/types';
import { createProvider, generateWithFallback, generateStreamingWithFallback } from '../../providers/ai/provider.factory';

export interface ChatJobData {
  messages: AIMessage[];
  userId: string | null;
  jobId: string;
  timestamp: number;
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream: boolean;
  onChunk?: (chunk: StreamChunk) => void; // Only for streaming jobs
}

export interface ChatResult {
  content: string | null;
  model: string;
  provider: string;
  tokens: { prompt: number; completion: number; total: number };
  latency: number;
  finishReason?: string;
}

export class AIOrchestrationService {
  private readonly JOB_TIMEOUT_MS = 120000; // 2 minutes
  private readonly POLL_INTERVAL_MS = 1000; // 1 second

  async submitChatJob(
    messages: AIMessage[],
    userId: string | null = null,
    provider?: string,
    model?: string,
    temperature?: number,
    maxTokens?: number,
    topP?: number,
    stream: boolean = false
  ): Promise<string> {
    const jobId = this.generateJobId();
    
    try {
      const job = await aiQueue.add('ai-chat', {
        messages,
        userId,
        jobId,
        timestamp: Date.now(),
        provider,
        model,
        temperature,
        maxTokens,
        topP,
        stream,
        // Note: onChunk callback cannot be serialized, so we'll handle streaming differently
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        jobId
      });

      logger.info({ jobId, userId, provider, model, stream }, 'AI chat job submitted');
      return jobId;
    } catch (error) {
      logger.error({ error, userId, provider, model }, 'Failed to submit AI chat job');
      throw new AppError('Failed to submit AI request', 500, 'JOB_SUBMISSION_FAILED');
    }
  }

  async getJobResult(jobId: string): Promise<ChatResult | null> {
    try {
      const job = await aiQueue.getJob(jobId);
      
      if (!job) {
        return null;
      }

      const state = await job.getState();
      
      switch (state) {
        case 'completed':
          return job.returnvalue as ChatResult;
        case 'failed':
          const failedReason = await job.getFailedReason();
          throw new AppError(`AI processing failed: ${failedReason}`, 500, 'AI_PROCESSING_FAILED');
        case 'active':
        case 'waiting':
        case 'delayed':
        case 'paused':
          // Job still processing
          return null;
        default:
          throw new AppError(`Unknown job state: ${state}`, 500, 'UNKNOWN_JOB_STATE');
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, jobId }, 'Error getting AI job result');
      throw new AppError('Failed to retrieve AI job result', 500, 'JOB_RESULT_FAILED');
    }
  }

  async waitForJobResult(jobId: string, timeoutMs: number = this.JOB_TIMEOUT_MS): Promise<ChatResult> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const result = await this.getJobResult(jobId);
      
      if (result !== null) {
        return result;
      }
      
      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, this.POLL_INTERVAL_MS));
    }
    
    throw new AppError('AI job timed out', 504, 'JOB_TIMEOUT');
  }

  // Non-streaming chat interface (maintains backward compatibility)
  async chat(
    messages: AIMessage[],
    userId: string | null = null,
    provider?: string,
    model?: string,
    temperature?: number,
    maxTokens?: number,
    topP?: number
  ): Promise<ChatResult> {
    // For non-streaming, we can still use direct processing for low latency
    // or use queued processing for better scalability
    
    // For now, let's keep direct processing but with better error handling
    // In a production system with high volume, we'd route this to queues
    
    try {
      const selectedProvider = provider || this.determineProvider();
      const selectedModel = model || this.getDefaultModel(selectedProvider);
      
      const providerInstance = createProvider(selectedProvider, this.getProviderKey(selectedProvider));
      
      const request: CompletionRequest = {
        messages,
        model: selectedModel,
        temperature,
        maxTokens,
        topP
      };

      const start = Date.now();
      
      const result = await this.withTimeout(
        providerInstance.generateCompletion(request),
        30000, // 30 second timeout
        `AI completion via ${selectedProvider}`
      );

      const latency = Date.now() - start;
      
      // Deduct credits if user is authenticated
      if (userId && userId !== 'anonymous') {
        await this.deductCredits(userId, result.tokens.total).catch(() => {});
      }

      return {
        content: result.content,
        model: result.model,
        provider: result.provider,
        tokens: result.tokens,
        latency,
        finishReason: result.finishReason
      };
    } catch (error) {
      logger.error({ error, userId, provider, model }, 'AI chat failed');
      
      if (error instanceof AppError) {
        throw error;
      }
      
      if (error.message?.includes('timed out')) {
        throw new AppError('AI request timed out. Please try again or use a different model.', 504, 'TIMEOUT');
      }
      
      // Handle provider-specific errors
      if (error.name === 'ProviderError') {
        throw new AppError(error.message, error.statusCode, error.code);
      }
      
      throw new AppError(`AI error: ${error.message || 'Unknown error'}`, 500, 'AI_ERROR');
    }
  }

  // Streaming chat interface (for real-time responses)
  async chatStream(
    messages: AIMessage[],
    onChunk: (chunk: StreamChunk) => Promise<void> | void,
    userId: string | null = null,
    provider?: string,
    model?: string,
    temperature?: number,
    maxTokens?: number,
    topP?: number
  ): Promise<ChatResult> {
    // For streaming, we need to maintain the connection
    // In a production system, we might use WebSockets or Server-Sent Events
    // with a job ID to track progress
    
    try {
      const selectedProvider = provider || this.determineProvider();
      const selectedModel = model || this.getDefaultModel(selectedProvider);
      
      const providerInstance = createProvider(selectedProvider, this.getProviderKey(selectedProvider));
      
      const request: CompletionRequest = {
        messages,
        model: selectedModel,
        temperature,
        maxTokens,
        topP,
        stream: true
      };

      const start = Date.now();
      
      const result = await providerInstance.generateStreaming(request, onChunk);
      
      const latency = Date.now() - start;
      
      // Deduct credits if user is authenticated
      if (userId && userId !== 'anonymous') {
        await this.deductCredits(userId, result.tokens.total);
      }

      return {
        content: result.content,
        model: result.model,
        provider: result.provider,
        tokens: result.tokens,
        latency,
        finishReason: result.finishReason
      };
    } catch (error) {
      logger.error({ error, userId, provider, model }, 'AI chat stream failed');
      
      if (error instanceof AppError) {
        throw error;
      }
      
      // Handle provider-specific errors
      if (error.name === 'ProviderError') {
        throw new AppError(error.message, error.statusCode, error.code);
      }
      
      throw error;
    }
  }

  private determineProvider(): string {
    // Simple fallback logic - in production this would be more sophisticated
    const providerPriority = ['gemini', 'openrouter', 'ollama'];
    
    for (const provider of providerPriority) {
      const apiKey = this.getProviderKey(provider);
      if (apiKey || provider === 'ollama') {
        return provider;
      }
    }
    
    // Default to gemini if nothing else is available
    return 'gemini';
  }

  private getProviderKey(providerName: string): string | undefined {
    const keyMap: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      gemini: 'GEMINI_API_KEY',
      groq: 'GROQ_API_KEY',
      openrouter: 'OPENROUTER_API_KEY',
    };
    
    const envKey = keyMap[providerName.toLowerCase()];
    return envKey ? process.env[envKey] : undefined;
  }

  private getDefaultModel(provider: string): string {
    const defaultModels: Record<string, string> = {
      openai: 'gpt-4o',
      anthropic: 'claude-3-sonnet-20240229',
      gemini: 'gemini-pro',
      groq: 'llama3-70b-8192',
      openrouter: 'auto',
      ollama: 'llama3'
    };
    
    return defaultModels[provider] || 'gemini-pro';
  }

  private generateJobId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation '${operation}' timed out after ${timeoutMs}ms`)), timeoutMs)
    );
    return Promise.race([promise, timeout]);
  }

  private async deductCredits(userId: string, tokens: number): Promise<void> {
    try {
      const subscription = await prisma.subscription.findUnique({ where: { userId } });

      if (!subscription) {
        throw new AppError('No subscription found', 404);
      }

      const available = subscription.aiCredits - subscription.aiCreditsUsed;

      if (available < tokens) {
        throw new AppError('Insufficient AI credits', 402, 'INSUFFICIENT_CREDITS');
      }

      await prisma.subscription.update({
        where: { userId },
        data: { aiCreditsUsed: { increment: tokens } },
      });

      await prisma.usageRecord.create({
        data: {
          userId,
          type: 'ai_chat',
          tokens,
          model: subscription.tier,
          provider: 'internal',
        },
      });
    } catch (error) {
      logger.error({ error, userId, tokens }, 'Failed to deduct AI credits');
      // Don't fail the request if credit deduction fails - log and continue
      // In a production system, you might want to handle this differently
    }
  }
}

export const aiOrchestrationService = new AIOrchestrationService();
