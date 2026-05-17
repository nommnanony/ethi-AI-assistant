import { transcriptionService } from '../../modules/transcription/transcription.service';
import { eventRegistry, type WsEvent, type HandlerContext, type TranscriptionStartPayload } from '../events';
import { connectionManager } from '../connection';
import { logger } from '../../common/logger';

export function registerTranscriptionHandlers(): void {
  eventRegistry.on('transcription:start', async (event: WsEvent, context: HandlerContext) => {
    try {
      const payload = event.payload as TranscriptionStartPayload;

      const session = await transcriptionService.startSession(context.userId, {
        workspaceId: payload.workspaceId ?? '',
        provider: payload.provider as any,
        language: payload.language ?? 'en',
        encoding: payload.encoding,
        sampleRate: payload.sampleRate,
        channels: payload.channels,
        model: payload.model,
        punctuate: payload.punctuate,
        diarize: payload.diarize,
        interimResults: payload.interimResults,
        keywords: payload.keywords,
      });

      connectionManager.joinRoom(session.workspaceId ?? '', context.userId);

      context.socket.send(
        JSON.stringify({
          type: 'transcription:started',
          payload: { sessionId: session.id, workspaceId: session.workspaceId ?? '', status: 'active' },
        }),
      );
    } catch (error) {
      logger.error({ err: error, userId: context.userId }, 'Failed to start transcription session');
      context.socket.send(
        JSON.stringify({
          type: 'error',
          payload: { code: 'TRANSCRIPTION_START_FAILED', message: 'Failed to start transcription session' },
        }),
      );
    }
  });

  eventRegistry.on('transcription:audio', async (event: WsEvent, context: HandlerContext) => {
    const payload = event.payload as { sessionId: string; audio: string };

    try {
      const buffer = Buffer.from(payload.audio, 'base64');
      await transcriptionService.processAudioChunk(payload.sessionId, buffer);
    } catch (error) {
      logger.error({ err: error, userId: context.userId, sessionId: payload.sessionId }, 'Audio chunk processing failed');
    }
  });

  eventRegistry.on('transcription:stop', async (event: WsEvent, context: HandlerContext) => {
    const payload = event.payload as { sessionId: string };

    try {
      const transcript = await transcriptionService.stopSession(payload.sessionId);
      context.socket.send(
        JSON.stringify({
          type: 'transcription:complete',
          payload: { sessionId: payload.sessionId, transcript },
        }),
      );
    } catch (error) {
      logger.error({ err: error, userId: context.userId, sessionId: payload.sessionId }, 'Failed to stop transcription');
      context.socket.send(
        JSON.stringify({
          type: 'error',
          payload: { code: 'TRANSCRIPTION_STOP_FAILED', message: 'Failed to stop transcription' },
        }),
      );
    }
  });
}
