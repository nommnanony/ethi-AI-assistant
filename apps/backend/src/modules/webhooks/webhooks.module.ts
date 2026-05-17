import type { FastifyInstance } from 'fastify';
import { registerWebhooksRoutes } from './webhooks.routes';

export const webhooksModule = {
  async register(app: FastifyInstance) {
    await registerWebhooksRoutes(app);
  },
};
