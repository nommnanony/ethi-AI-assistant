import type { FastifyInstance } from 'fastify';
import { usersController } from '../../presentation/controllers/users.controller';
import { authGuard } from '../../common/guards/auth.guard';

export async function registerUsersRoutes(app: FastifyInstance) {
  app.get('/api/users/profile', {
    preHandler: [authGuard],
    handler: usersController.getProfile,
  });

  app.patch('/api/users/profile', {
    preHandler: [authGuard],
    handler: usersController.updateProfile,
  });

  app.delete('/api/users/account', {
    preHandler: [authGuard],
    handler: usersController.deleteAccount,
  });

  app.get('/api/users/api-keys', {
    preHandler: [authGuard],
    handler: usersController.getApiKeys,
  });

  app.post('/api/users/api-keys', {
    preHandler: [authGuard],
    handler: usersController.createApiKey,
  });

  app.delete('/api/users/api-keys/:id', {
    preHandler: [authGuard],
    handler: usersController.revokeApiKey,
  });
}
