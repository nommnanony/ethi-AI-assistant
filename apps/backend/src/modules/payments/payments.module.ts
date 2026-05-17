import type { FastifyInstance } from 'fastify';
import { registerPaymentsRoutes } from './payments.routes';

export const paymentsModule = {
  async register(app: FastifyInstance) {
    await registerPaymentsRoutes(app);
  },
};
