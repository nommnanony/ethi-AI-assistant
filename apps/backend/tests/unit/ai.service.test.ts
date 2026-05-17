import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/database/prisma/client.js', () => ({
  default: {
    subscription: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    usageRecord: {
      create: vi.fn(),
    },
    userAIConfig: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('../../src/common/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}));

vi.mock('../../src/common/error-handler.js', () => ({
  AppError: class AppError extends Error {
    constructor(
      message: string,
      public statusCode: number = 500,
      public code?: string,
    ) {
      super(message);
      this.name = 'AppError';
    }
  },
}));

vi.mock('../../src/providers/ai/provider.factory.js', () => ({
  createProvider: vi.fn(),
  getAvailableProviders: vi.fn(),
}));

vi.mock('../../src/providers/ai/types.js', () => ({
  ProviderError: class ProviderError extends Error {
    constructor(
      message: string,
      public provider: string,
      public statusCode: number = 500,
      public code?: string,
    ) {
      super(message);
      this.name = 'ProviderError';
    }
  },
}));

import { aiService } from '../../src/modules/ai/ai.service.js';
import prisma from '../../src/database/prisma/client.js';
import { createProvider, getAvailableProviders } from '../../src/providers/ai/provider.factory.js';

const mockCompletionResponse = {
  content: 'Hello! How can I help you today?',
  model: 'gpt-4o',
  provider: 'openai',
  tokens: { prompt: 10, completion: 20, total: 30 },
  latency: 500,
  finishReason: 'stop',
};

const mockStreamChunk = {
  type: 'content' as const,
  content: 'Hello!',
};

const mockProvider = {
  name: 'openai',
  generateCompletion: vi.fn().mockResolvedValue(mockCompletionResponse),
  generateStreaming: vi.fn().mockResolvedValue(mockCompletionResponse),
};

const mockSubscription = {
  id: 'sub-1',
  userId: 'user-1',
  tier: 'PRO',
  status: 'ACTIVE',
  aiCredits: 1000,
  aiCreditsUsed: 100,
  aiCreditsResetAt: null,
};

describe('AIService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (createProvider as any).mockReturnValue(mockProvider);
  });

  describe('chat', () => {
    it('should complete a chat with default provider', async () => {
      (prisma.subscription.findUnique as any).mockResolvedValue(mockSubscription);
      (prisma.subscription.update as any).mockResolvedValue({});
      (prisma.usageRecord.create as any).mockResolvedValue({});

      const result = await aiService.chat(
        [{ role: 'user', content: 'Hello' }],
        'openai',
        undefined,
        'user-1',
      );

      expect(result.content).toBe('Hello! How can I help you today?');
      expect(result.tokens.total).toBe(30);
      expect(createProvider).toHaveBeenCalledWith('openai');
      expect(mockProvider.generateCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'gpt-4o',
        }),
      );
    });

    it('should deduct credits when userId is provided', async () => {
      (prisma.subscription.findUnique as any).mockResolvedValue(mockSubscription);
      (prisma.subscription.update as any).mockResolvedValue({});
      (prisma.usageRecord.create as any).mockResolvedValue({});

      await aiService.chat(
        [{ role: 'user', content: 'Hi' }],
        'openai',
        undefined,
        'user-1',
      );

      expect(prisma.subscription.update).toHaveBeenCalled();
      expect(prisma.usageRecord.create).toHaveBeenCalled();
    });

    it('should use specified model', async () => {
      (prisma.subscription.findUnique as any).mockResolvedValue(mockSubscription);
      (prisma.subscription.update as any).mockResolvedValue({});
      (prisma.usageRecord.create as any).mockResolvedValue({});

      await aiService.chat(
        [{ role: 'user', content: 'Hello' }],
        'anthropic',
        'claude-3-sonnet-20240229',
        'user-1',
      );

      expect(mockProvider.generateCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-sonnet-20240229',
        }),
      );
    });

    it('should throw AppError on ProviderError', async () => {
      const { AppError } = await import('../../src/common/error-handler.js');
      const { ProviderError } = await import('../../src/providers/ai/types.js');

      mockProvider.generateCompletion.mockRejectedValue(
        new ProviderError('API key invalid', 'openai', 401, 'AUTH_ERROR'),
      );

      await expect(
        aiService.chat([{ role: 'user', content: 'Hello' }], 'openai'),
      ).rejects.toThrow(AppError);
    });

    it('should not deduct credits when userId is not provided', async () => {
      mockProvider.generateCompletion.mockResolvedValue(mockCompletionResponse);

      await aiService.chat([{ role: 'user', content: 'Hello' }], 'openai');

      expect(prisma.subscription.update).not.toHaveBeenCalled();
      expect(prisma.usageRecord.create).not.toHaveBeenCalled();
    });
  });

  describe('chatStream', () => {
    it('should stream chat completion', async () => {
      (prisma.subscription.findUnique as any).mockResolvedValue(mockSubscription);
      (prisma.subscription.update as any).mockResolvedValue({});
      (prisma.usageRecord.create as any).mockResolvedValue({});

      const onChunk = vi.fn();
      const result = await aiService.chatStream(
        [{ role: 'user', content: 'Hello' }],
        onChunk,
        'openai',
        undefined,
        'user-1',
      );

      expect(result.content).toBe('Hello! How can I help you today?');
      expect(mockProvider.generateStreaming).toHaveBeenCalled();
    });
  });

  describe('checkCredits', () => {
    it('should return credit info when sufficient', async () => {
      (prisma.subscription.findUnique as any).mockResolvedValue(mockSubscription);

      const result = await aiService.checkCredits('user-1');

      expect(result).toEqual({
        available: 900,
        total: 1000,
        used: 100,
        sufficient: true,
      });
    });

    it('should return sufficient false when credits exhausted', async () => {
      (prisma.subscription.findUnique as any).mockResolvedValue({
        ...mockSubscription,
        aiCredits: 100,
        aiCreditsUsed: 100,
      });

      const result = await aiService.checkCredits('user-1');

      expect(result.available).toBe(0);
      expect(result.sufficient).toBe(false);
    });

    it('should throw AppError when no subscription found', async () => {
      (prisma.subscription.findUnique as any).mockResolvedValue(null);

      await expect(aiService.checkCredits('user-1')).rejects.toMatchObject({
        statusCode: 404,
        message: 'No subscription found',
      });
    });
  });

  describe('getProviderConfig', () => {
    it('should return provider configs for user', async () => {
      const configs = [
        { id: 'c1', provider: 'OPENAI', model: 'GPT_4O', isDefault: true },
        { id: 'c2', provider: 'ANTHROPIC', model: 'CLAUDE_3_SONNET', isDefault: false },
      ];
      (prisma.userAIConfig.findMany as any).mockResolvedValue(configs);

      const result = await aiService.getProviderConfig('user-1');

      expect(result).toEqual(configs);
      expect(prisma.userAIConfig.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { isDefault: 'desc' },
      });
    });
  });

  describe('setProviderConfig', () => {
    it('should create new config for user', async () => {
      (prisma.userAIConfig.findFirst as any).mockResolvedValue(null);
      (prisma.userAIConfig.create as any).mockResolvedValue({ id: 'c1', provider: 'OPENAI' });

      const result = await aiService.setProviderConfig('user-1', {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.8,
      });

      expect(prisma.userAIConfig.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            provider: 'OPENAI',
            model: 'GPT_4O',
          }),
        }),
      );
    });

    it('should update existing provider config', async () => {
      (prisma.userAIConfig.findFirst as any).mockResolvedValue({ id: 'c1', provider: 'OPENAI' });
      (prisma.userAIConfig.update as any).mockResolvedValue({ id: 'c1', provider: 'OPENAI', temperature: 0.5 });

      await aiService.setProviderConfig('user-1', {
        provider: 'openai',
        temperature: 0.5,
      });

      expect(prisma.userAIConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1' },
          data: expect.objectContaining({ temperature: 0.5 }),
        }),
      );
    });

    it('should unset other defaults when setting isDefault', async () => {
      (prisma.userAIConfig.findFirst as any).mockResolvedValue(null);
      (prisma.userAIConfig.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.userAIConfig.create as any).mockResolvedValue({ id: 'c2' });

      await aiService.setProviderConfig('user-1', {
        provider: 'anthropic',
        isDefault: true,
      });

      expect(prisma.userAIConfig.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isDefault: true },
        data: { isDefault: false },
      });
    });
  });

  describe('getAvailableProviders', () => {
    it('should return list of providers', () => {
      (getAvailableProviders as any).mockReturnValue(['openai', 'anthropic', 'ollama']);

      const result = aiService.getAvailableProviders();

      expect(result).toEqual(['openai', 'anthropic', 'ollama']);
      expect(getAvailableProviders).toHaveBeenCalled();
    });
  });
});
