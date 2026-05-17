import { randomUUID } from 'crypto';
import { prisma } from '../../database/prisma/client';
import { logger } from '../../shared/logger/logger.service';
import { errorService } from '../../shared/error-handling/error.service';
import { AppError } from '../../shared/error-handling/error.service';
import { config } from '../../config/env';
import {
  createTranscriptionProvider,
  createTranscriptionEventHandler,
} from '../../providers/transcription/index';
import { createProvider } from '../../providers/ai/provider.factory';
import type { TranscriptionProvider } from '../../providers/transcription/types';
import type { 
  StartSessionInput, 
  ListTranscriptsQuery,
  TranscriptIdParams,
  AudioChunkData,
  GenerateSummaryOptions
} from '../../modules/transcription/transcription.validator';

interface ActiveSession {
  provider: TranscriptionProvider;
  userId: string;
  startedAt: Date;
}

export class TranscriptionApplicationService {
  private activeSessions = new Map<string, ActiveSession>();
  private finalizedTranscripts = new Set<string>();

  async startSession(userId: string, input: StartSessionInput) {
    try {
      const transcript = await prisma.transcript.create({
        data: {
          userId,
          workspaceId: input.workspaceId,
          provider: input.provider.toUpperCase() as any,
          language: input.language,
          status: 'ACTIVE',
          isStreaming: true,
        },
      });

      const apiKey = this.resolveApiKey(input.provider);

      const provider = createTranscriptionProvider({
        provider: input.provider,
        apiKey,
        options: {
          language: input.language,
          encoding: input.encoding,
          sampleRate: input.sampleRate,
          channels: input.channels,
          model: input.model,
          punctuate: input.punctuate,
          diarize: input.diarize,
          interimResults: input.interimResults,
          keywords: input.keywords,
        },
      });

      await provider.startStream({
        language: input.language,
        encoding: input.encoding,
        sampleRate: input.sampleRate,
        channels: input.channels,
        model: input.model,
        punctuate: input.punctuate,
        diarize: input.diarize,
        interimResults: input.interimResults,
        keywords: input.keywords,
      });

      this.wireProviderEvents(transcript.id, provider);

      this.activeSessions.set(transcript.id, {
        provider,
        userId,
        startedAt: new Date(),
      });

      logger.info({ transcriptId: transcript.id, userId, provider: input.provider }, 'Transcription session started');

      return transcript;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, userId, input }, 'Failed to start transcription session');
      throw new AppError('Failed to start transcription session', 500, 'TRANSCRIPTION_START_FAILED');
    }
  }

  async processAudioChunk(transcriptId: string, audioBuffer: Buffer) {
    try {
      const session = this.activeSessions.get(transcriptId);
      if (!session) {
        throw new AppError('No active transcription session found. Start a session first.', 404, 'SESSION_NOT_FOUND');
      }

      await session.provider.processAudioChunk(audioBuffer);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, transcriptId }, 'Failed to process audio chunk');
      throw new AppError('Failed to process audio chunk', 500, 'AUDIO_CHUNK_PROCESS_FAILED');
    }
  }

  async stopSession(transcriptId: string) {
    try {
      const session = this.activeSessions.get(transcriptId);
      if (!session) {
        throw new AppError('No active transcription session found', 404, 'SESSION_NOT_FOUND');
      }

      try {
        await session.provider.stopStream();
      } catch (error) {
        logger.error({ err: error, transcriptId }, 'Error stopping transcription provider stream');
      }

      await this.finalizeTranscript(transcriptId);
      await session.provider.destroy();
      this.activeSessions.delete(transcriptId);

      logger.info({ transcriptId }, 'Transcription session stopped');

      return this.getTranscript(transcriptId);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, transcriptId }, 'Failed to stop transcription session');
      throw new AppError('Failed to stop transcription session', 500, 'TRANSCRIPTION_STOP_FAILED');
    }
  }

  async getTranscript(transcriptId: string) {
    try {
      const transcript = await prisma.transcript.findUnique({
        where: { id: transcriptId },
        include: {
          segments: {
            orderBy: { startTime: 'asc' },
          },
        },
      });

      if (!transcript || transcript.deletedAt) {
        throw new AppError('Transcript not found', 404, 'TRANSCRIPT_NOT_FOUND');
      }

      return transcript;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, transcriptId }, 'Failed to get transcript');
      throw new AppError('Failed to retrieve transcript', 500, 'TRANSCRIPT_FETCH_FAILED');
    }
  }

  async listTranscripts(userId: string, query: ListTranscriptsQuery) {
    try {
      const { page, limit, status } = query;
      const skip = (page - 1) * limit;

      const where: any = {
        userId,
        deletedAt: null,
      };

      if (status) {
        where.status = status;
      }

      const [transcripts, total] = await Promise.all([
        prisma.transcript.findMany({
          where,
          include: {
            _count: { select: { segments: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.transcript.count({ where }),
      ]);

      return {
        data: transcripts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: skip + limit < total,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, userId, query }, 'Failed to list transcripts');
      throw new AppError('Failed to retrieve transcripts', 500, 'TRANSCRIPTS_LIST_FAILED');
    }
  }

  async generateSummary(transcriptId: string, options?: GenerateSummaryOptions) {
    try {
      const transcript = await this.getTranscript(transcriptId);

      if (transcript.aiSummary) {
        return { summary: transcript.aiSummary, cached: true };
      }

      const fullText = transcript.segments
        .map((s) => {
          const speaker = s.speakerName ? `${s.speakerName}: ` : '';
          return `${speaker}${s.content}`;
        })
        .join('\n');

      if (!fullText.trim()) {
        throw new AppError('Transcript has no content to summarize', 400, 'EMPTY_TRANSCRIPT');
      }

      try {
        const provider = createProvider('openai');

        const response = await provider.generateCompletion({
          model: options?.model ?? 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a professional transcription summarizer. Analyze the given transcript and provide:
1. A concise summary (2-3 sentences)
2. Key points discussed (bullet points)
3. Action items (if any)

Format the response using markdown.`,
            },
            {
              role: 'user',
              content: fullText,
            },
          ],
          temperature: options?.temperature ?? 0.3,
          maxTokens: options?.maxTokens ?? 1024,
        });

        const summary = response.content ?? '';

        await prisma.transcript.update({
          where: { id: transcriptId },
          data: { aiSummary: summary },
        });

        logger.info({ transcriptId, model: response.model, tokens: response.tokens }, 'Transcript summary generated');

        return { summary, cached: false, model: response.model, tokens: response.tokens };
      } catch (error) {
        logger.error({ err: error, transcriptId }, 'Failed to generate transcript summary');
        throw new AppError('Failed to generate summary. Please try again.', 500, 'SUMMARY_FAILED');
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, transcriptId }, 'Failed to generate transcript summary');
      throw new AppError('Failed to generate transcript summary', 500, 'SUMMARY_FAILED');
    }
  }

  async deleteTranscript(transcriptId: string) {
    try {
      const transcript = await prisma.transcript.findUnique({
        where: { id: transcriptId },
      });

      if (!transcript || transcript.deletedAt) {
        throw new AppError('Transcript not found', 404, 'TRANSCRIPT_NOT_FOUND');
      }

      const session = this.activeSessions.get(transcriptId);
      if (session) {
        try {
          await session.provider.stopStream();
          await session.provider.destroy();
        } catch {
          // ignore cleanup errors
        }
        this.activeSessions.delete(transcriptId);
      }

      await prisma.transcript.update({
        where: { id: transcriptId },
        data: { deletedAt: new Date() },
      });

      logger.info({ transcriptId }, 'Transcript deleted');
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, transcriptId }, 'Failed to delete transcript');
      throw new AppError('Failed to delete transcript', 500, 'TRANSCRIPT_DELETE_FAILED');
    }
  }

  async getActiveSessionUser(transcriptId: string): Promise<string | null> {
    try {
      const session = this.activeSessions.get(transcriptId);
      return session?.userId ?? null;
    } catch (error) {
      logger.error({ error, transcriptId }, 'Failed to get active session user');
      throw new AppError('Failed to get active session user', 500, 'ACTIVE_SESSION_USER_FAILED');
    }
  }

  private async finalizeTranscript(transcriptId: string) {
    try {
      if (this.finalizedTranscripts.has(transcriptId)) {
        return;
      }
      this.finalizedTranscripts.add(transcriptId);

      const segments = await prisma.transcriptSegment.findMany({
        where: { transcriptId },
        orderBy: { endTime: 'desc' },
        take: 1,
      });

      const duration = segments.length > 0 ? segments[0].endTime : 0;

      await prisma.transcript.update({
        where: { id: transcriptId },
        data: {
          status: 'COMPLETED',
          isStreaming: false,
          duration: Math.round(duration),
        },
      });
    } catch (error) {
      logger.error({ err: error, transcriptId }, 'Failed to finalize transcript');
    } finally {
      setTimeout(() => {
        this.finalizedTranscripts.delete(transcriptId);
      }, 5000);
    }
  }

  private wireProviderEvents(transcriptId: string, provider: TranscriptionProvider) {
    try {
      createTranscriptionEventHandler(provider, {
        onSegment: async (event) => {
          if (!event.segment) return;
          try {
            await prisma.transcriptSegment.create({
              data: {
                transcriptId,
                speakerId: event.segment.speakerId ?? '',
                speakerName: event.segment.speakerName,
                content: event.segment.content,
                startTime: event.segment.startTime,
                endTime: event.segment.endTime,
                confidence: event.segment.confidence,
                isFinal: event.segment.isFinal,
              },
            });
          } catch (error) {
            logger.error({ err: error, transcriptId }, 'Failed to persist transcript segment');
          }
        },
        onError: async (event) => {
          logger.error({ error: event.error, transcriptId }, 'Transcription provider error');
        },
      });
    } catch (error) {
      logger.error({ error, transcriptId }, 'Failed to wire provider events');
    }
  }

  private resolveApiKey(provider: string): string {
    switch (provider) {
      case 'deepgram':
        return config.DEEPGRAM_API_KEY ?? '';
      case 'assemblyai':
        return config.ASSEMBLYAI_API_KEY ?? '';
      default:
        return '';
    }
  }
}

export const transcriptionApplicationService = new TranscriptionApplicationService();
