import type { FastifyInstance } from 'fastify';
import { registerAiRoutes } from './ai.routes';

export const aiModule = {
  async register(app: FastifyInstance) {
    await registerAiRoutes(app);
  },
};
