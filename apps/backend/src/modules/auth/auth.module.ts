import type { FastifyInstance } from 'fastify';
import { registerAuthRoutes } from './auth.routes';

export const authModule = {
  async register(app: FastifyInstance) {
    await registerAuthRoutes(app);
  },
};
