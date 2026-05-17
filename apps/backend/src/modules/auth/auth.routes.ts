import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../../application/services/auth.service';
import { registerSchema, loginSchema, refreshSchema } from './auth.validator';
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
    handler: authService.register,
  });

  app.post('/api/auth/login', {
    handler: authService.login,
  });

  app.post('/api/auth/refresh', {
    handler: authService.refreshToken,
  });

  app.post('/api/auth/logout', {
    handler: authService.logout,
  });

  app.get('/api/auth/sessions', {
    preHandler: [authGuard],
    handler: authService.getSessions,
  });

  app.delete('/api/auth/sessions/:sessionId', {
    preHandler: [authGuard],
    handler: authService.revokeSession,
  });

  app.get('/api/auth/me', {
    preHandler: [authGuard],
    handler: authService.getCurrentUser,
  });
}
