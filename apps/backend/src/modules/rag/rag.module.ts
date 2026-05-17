import type { FastifyInstance } from 'fastify';
import { ragRoutes } from './rag.routes';

export const ragModule = {
  register: async (app: FastifyInstance) => {
    await app.register(ragRoutes);
  },
};
