import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  startSessionSchema,
  audioChunkSchema,
  transcriptIdParamsSchema,
  listTranscriptsQuerySchema,
  generateSummarySchema,
} from '../validators/transcription.validator';
import { transcriptionApplicationService } from '../../application/services/transcription.service';
import { errorService } from '../../shared/error-handling/error.service';
import { AppError } from '../../shared/error-handling/error.service';
import { authGuard } from '../../common/guards/auth.guard';

export class TranscriptionController {
  async startSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const input = startSessionSchema.parse(request.body);
      const transcript = await transcriptionApplicationService.startSession(request.user!.sub, input);
      reply.code(201).send(transcript);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async processAudioChunk(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = transcriptIdParamsSchema.parse(request.params);
      const { audio, encoding } = audioChunkSchema.parse(request.body);
      const audioBuffer = Buffer.from(audio, 'base64');
      
      const sessionUser = await transcriptionApplicationService.getActiveSessionUser(id);
      if (sessionUser && sessionUser !== request.user!.sub) {
        throw new AppError('You do not have access to this transcription session', 403, 'FORBIDDEN');
      }

      await transcriptionApplicationService.processAudioChunk(id, audioBuffer);
      reply.send({ ok: true });
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async stopSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = transcriptIdParamsSchema.parse(request.params);
      const transcript = await transcriptionApplicationService.stopSession(id);
      reply.send(transcript);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async getTranscript(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = transcriptIdParamsSchema.parse(request.params);
      const transcript = await transcriptionApplicationService.getTranscript(id);

      if (transcript.userId !== request.user!.sub && request.user.role !== 'ADMIN' && request.user.role !== 'SUPER_ADMIN') {
        throw new AppError('You do not have access to this transcript', 403, 'FORBIDDEN');
      }

      reply.send(transcript);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async listTranscripts(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = listTranscriptsQuerySchema.parse(request.query);
      const result = await transcriptionApplicationService.listTranscripts(request.user!.sub, query);
      reply.send(result);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async generateSummary(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = transcriptIdParamsSchema.parse(request.params);
      const options = generateSummarySchema.parse(request.body ?? {});
      const result = await transcriptionApplicationService.generateSummary(id, options);
      reply.send(result);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async deleteTranscript(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = transcriptIdParamsSchema.parse(request.params);
      await transcriptionApplicationService.deleteTranscript(id);
      reply.code(204).send();
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }
}

export const transcriptionController = new TranscriptionController();
