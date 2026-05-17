import type { FastifyInstance } from 'fastify';
import { registerTranscriptionRoutes } from './transcription.routes';

export const transcriptionModule = {
  async register(app: FastifyInstance) {
    await registerTranscriptionRoutes(app);
  },
};
