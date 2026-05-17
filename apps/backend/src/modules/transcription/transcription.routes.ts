import type { FastifyInstance } from 'fastify';
import { transcriptionController } from '../../presentation/controllers/transcription.controller';
import { authGuard } from '../../common/guards/auth.guard';

export async function registerTranscriptionRoutes(app: FastifyInstance) {
  app.post('/api/transcription/start', {
    preHandler: [authGuard],
    handler: transcriptionController.startSession,
  });

  app.post('/api/transcription/:id/audio', {
    preHandler: [authGuard],
    handler: transcriptionController.processAudioChunk,
  });

  app.post('/api/transcription/:id/stop', {
    preHandler: [authGuard],
    handler: transcriptionController.stopSession,
  });

  app.get('/api/transcription/:id', {
    preHandler: [authGuard],
    handler: transcriptionController.getTranscript,
  });

  app.get('/api/transcription', {
    preHandler: [authGuard],
    handler: transcriptionController.listTranscripts,
  });

  app.post('/api/transcription/:id/summary', {
    preHandler: [authGuard],
    handler: transcriptionController.generateSummary,
  });

  app.delete('/api/transcription/:id', {
    preHandler: [authGuard],
    handler: transcriptionController.deleteTranscript,
  });
}
