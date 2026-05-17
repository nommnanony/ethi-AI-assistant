import type { FastifyInstance } from 'fastify';
import { logger } from '../common/logger';
import { redisConnection } from './queue';
import { createEmailWorker, closeEmailWorker } from './workers/email.worker';
import { createTranscriptionWorker, closeTranscriptionWorker } from './workers/transcription.worker';
import { createAnalyticsWorker, closeAnalyticsWorker } from './workers/analytics.worker';
import { createCleanupWorker, closeCleanupWorker } from './workers/cleanup.worker';

export function initWorkers(app: FastifyInstance) {
  logger.info('Initializing workers...');

  const emailWorker = createEmailWorker();
  const transcriptionWorker = createTranscriptionWorker();
  const analyticsWorker = createAnalyticsWorker();
  const cleanupWorker = createCleanupWorker();

  logger.info('All workers initialized successfully');

  return async function cleanup() {
    logger.info('Shutting down workers...');

    await Promise.all([
      closeEmailWorker(),
      closeTranscriptionWorker(),
      closeAnalyticsWorker(),
      closeCleanupWorker(),
    ]);

    await redisConnection.quit();

    logger.info('All workers shut down successfully');
  };
}

export {
  emailQueue,
  transcriptionQueue,
  analyticsQueue,
  notificationQueue,
  cleanupQueue,
} from './queue';

export type {
  EmailJobData,
  TranscriptionJobData,
  AnalyticsJobData,
  NotificationJobData,
  CleanupJobData,
} from './queue';
