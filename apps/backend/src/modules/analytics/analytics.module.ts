import type { FastifyInstance } from 'fastify';
import { registerAnalyticsRoutes } from './analytics.routes';

export const analyticsModule = {
  async register(app: FastifyInstance) {
    await registerAnalyticsRoutes(app);
  },
};
