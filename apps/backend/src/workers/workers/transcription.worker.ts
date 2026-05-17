import { Worker } from 'bullmq';
import prisma from '../../database/prisma/client';
import { config } from '../../config/env';
import { logger } from '../../common/logger';
import { createProvider } from '../../providers/ai/provider.factory';
import { redisConnection } from '../queue';
import type { TranscriptionJobData } from '../queue';

let worker: Worker<TranscriptionJobData> | null = null;

export function createTranscriptionWorker(): Worker<TranscriptionJobData> {
  if (worker) return worker;

  worker = new Worker<TranscriptionJobData>(
    'transcription',
    async (job) => {
      const { transcriptId, userId, audioUrl, generateSummary } = job.data;

      logger.info({ jobId: job.id, transcriptId, userId }, 'Processing transcription job');

      const transcript = await prisma.transcript.findUnique({
        where: { id: transcriptId },
        include: { segments: { orderBy: { startTime: 'asc' } } },
      });

      if (!transcript || transcript.deletedAt) {
        logger.error({ transcriptId }, 'Transcript not found for processing');
        return;
      }

      if ((transcript.status as string) !== 'PENDING' && (transcript.status as string) !== 'ACTIVE') {
        logger.warn({ transcriptId, status: transcript.status }, 'Transcript already processed');
        return;
      }

      await prisma.transcript.update({
        where: { id: transcriptId },
        data: { status: 'PROCESSING' as any },
      });

      try {
        if (audioUrl) {
          logger.info({ transcriptId, audioUrl }, 'Processing audio file for transcription');
        }

        const segments = transcript.segments;
        if (segments.length === 0) {
          logger.warn({ transcriptId }, 'No segments found in transcript');
        }

        await prisma.transcript.update({
          where: { id: transcriptId },
          data: {
            status: 'COMPLETED',
            isStreaming: false,
            duration: segments.length > 0
              ? Math.round(segments[segments.length - 1].endTime)
              : 0,
          },
        });

        if (generateSummary && segments.length > 0) {
          const fullText = segments
            .map((s) => {
              const speaker = s.speakerName ? `${s.speakerName}: ` : '';
              return `${speaker}${s.content}`;
            })
            .join('\n');

          if (fullText.trim()) {
            try {
              const aiProvider = createProvider('openai');
              const response = await aiProvider.generateCompletion({
                model: 'gpt-4o',
                messages: [
                  {
                    role: 'system',
                    content: `You are a professional transcription summarizer. Analyze the given transcript and provide:
1. A concise summary (2-3 sentences)
2. Key points discussed (bullet points)
3. Action items (if any)

Format the response using markdown.`,
                  },
                  { role: 'user', content: fullText },
                ],
                temperature: 0.3,
                maxTokens: 1024,
              });

              await prisma.transcript.update({
                where: { id: transcriptId },
                data: { aiSummary: response.content ?? '' },
              });

              logger.info({ transcriptId, model: response.model }, 'AI summary generated for transcript');
            } catch (summaryError) {
              logger.error({ err: summaryError, transcriptId }, 'Failed to generate AI summary');
            }
          }
        }

        logger.info({ jobId: job.id, transcriptId }, 'Transcription job completed');
      } catch (error) {
        await prisma.transcript.update({
          where: { id: transcriptId },
          data: { status: 'FAILED' as any },
        });

        throw error;
      }
    },
    {
      connection: redisConnection,
      prefix: config.REDIS_PREFIX,
      concurrency: 3,
      lockDuration: 120000,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id, transcriptId: job?.data.transcriptId }, 'Transcription job failed');
  });

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id, transcriptId: job.data.transcriptId }, 'Transcription job completed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Transcription worker error');
  });

  return worker;
}

export async function closeTranscriptionWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
