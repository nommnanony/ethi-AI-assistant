import type { FastifyInstance } from 'fastify';
import { registerWorkspaceRoutes } from './workspace.routes';

export const workspaceModule = {
  async register(app: FastifyInstance) {
    await registerWorkspaceRoutes(app);
  },
};
