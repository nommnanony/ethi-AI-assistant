import type { FastifyInstance } from 'fastify';
import { registerUsersRoutes } from './users.routes';

export const usersModule = {
  async register(app: FastifyInstance) {
    await registerUsersRoutes(app);
  },
};
