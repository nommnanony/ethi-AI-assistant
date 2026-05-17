import type { FastifyInstance } from 'fastify';
import { registerSubscriptionsRoutes } from './subscriptions.routes';

export const subscriptionsModule = {
  async register(app: FastifyInstance) {
    await registerSubscriptionsRoutes(app);
  },
};
