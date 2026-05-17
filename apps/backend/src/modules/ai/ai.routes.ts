import type { FastifyInstance } from 'fastify';
import { aiController } from '../../presentation/controllers/ai.controller';
import { ZChatRequest, ZAIConfigUpdate } from './ai.validator';
import { authGuard, optionalAuth, getUserId } from '../../common/guards/auth.guard';

export async function registerAiRoutes(app: FastifyInstance) {
  // Public chat endpoint - no auth required for testing
  app.post('/api/ai/chat', {
    preHandler: [optionalAuth],
    handler: aiController.chat,
  });

  // Streaming chat endpoint
  app.post('/api/ai/chat/stream', {
    preHandler: [optionalAuth],
    handler: aiController.chatStream,
  });

  // Health check - test AI providers
  app.get('/api/ai/health', {
    handler: aiController.healthCheck,
  });

  // Protected endpoints
  app.get('/api/ai/providers', {
    handler: aiController.getProviders,
  });

  app.get('/api/ai/config', {
    preHandler: [optionalAuth],
    handler: aiController.getProviderConfig,
  });

  app.put('/api/ai/config', {
    preHandler: [optionalAuth],
    handler: aiController.updateProviderConfig,
  });


  app.post('/api/ai/custom', {
    handler: aiController.executeCustomProvider,
  });
}
