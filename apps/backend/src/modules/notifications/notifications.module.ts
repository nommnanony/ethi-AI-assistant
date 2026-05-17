import type { FastifyInstance } from 'fastify';
import { registerNotificationsRoutes } from './notifications.routes';

export const notificationsModule = {
  async register(app: FastifyInstance) {
    await registerNotificationsRoutes(app);
  },
};
