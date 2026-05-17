import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authController } from './auth.controller';
import { authGuard } from '../../common/guards/auth.guard';
import { errorService } from '../../shared/error-handling/error.service';

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post('/api/auth/register', {
    schema: {
      tags: ['Auth'],
      description: 'Register a new user',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          name: { type: 'string' },
        },
      },
    } as const,
    handler: authController.register,
  });

  app.post('/api/auth/login', {
    handler: authController.login,
  });

  app.post('/api/auth/refresh', {
    handler: authController.refreshToken,
  });

  app.post('/api/auth/logout', {
    handler: authController.logout,
  });

  app.get('/api/auth/sessions', {
    preHandler: [authGuard],
    handler: authController.getSessions,
  });

  app.delete('/api/auth/sessions/:sessionId', {
    preHandler: [authGuard],
    handler: authController.revokeSession,
  });

  app.get('/api/auth/me', {
    preHandler: [authGuard],
    handler: authController.getCurrentUser,
  });
}
