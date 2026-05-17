import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { config } from '../config/env';
import { logger } from '../common/logger';

const redisConnection = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redisConnection.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});

redisConnection.on('connect', () => {
  logger.info('Redis connected successfully');
});

export interface EmailJobData {
  type: 'welcome' | 'magic-link' | 'password-reset' | 'invoice' | 'subscription-canceled';
  to: string;
  data: Record<string, unknown>;
}

export interface TranscriptionJobData {
  transcriptId: string;
  userId: string;
  audioUrl?: string;
  generateSummary?: boolean;
}

export interface AnalyticsJobData {
  action: 'aggregate-usage' | 'cleanup-raw-data';
  userId?: string;
  retentionDays?: number;
}

export interface NotificationJobData {
  type: 'push' | 'in-app';
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface CleanupJobData {
  type: 'expired-sessions' | 'old-transcripts' | 'reset-ai-credits' | 'expired-refresh-tokens';
  dryRun?: boolean;
}

export const emailQueue = new Queue<EmailJobData>('email', {
  connection: redisConnection,
  prefix: config.REDIS_PREFIX,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 7 * 24 * 3600 },
    removeOnFail: { age: 14 * 24 * 3600 },
  },
});

export const transcriptionQueue = new Queue<TranscriptionJobData>('transcription', {
  connection: redisConnection,
  prefix: config.REDIS_PREFIX,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { age: 7 * 24 * 3600 },
    removeOnFail: { age: 14 * 24 * 3600 },
  },
});

export const analyticsQueue = new Queue<AnalyticsJobData>('analytics', {
  connection: redisConnection,
  prefix: config.REDIS_PREFIX,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 5000 },
    removeOnComplete: { age: 3 * 24 * 3600 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export const notificationQueue = new Queue<NotificationJobData>('notification', {
  connection: redisConnection,
  prefix: config.REDIS_PREFIX,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { age: 7 * 24 * 3600 },
    removeOnFail: { age: 14 * 24 * 3600 },
  },
});

export const cleanupQueue = new Queue<CleanupJobData>('cleanup', {
  connection: redisConnection,
  prefix: config.REDIS_PREFIX,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 24 * 3600 },
    removeOnFail: { age: 3 * 24 * 3600 },
  },
});

export { redisConnection };
