import { Worker } from 'bullmq';
import prisma from '../../database/prisma/client';
import { config } from '../../config/env';
import { logger } from '../../common/logger';
import { redisConnection } from '../queue';
import type { AnalyticsJobData } from '../queue';

let worker: Worker<AnalyticsJobData> | null = null;

export function createAnalyticsWorker(): Worker<AnalyticsJobData> {
  if (worker) return worker;

  worker = new Worker<AnalyticsJobData>(
    'analytics',
    async (job) => {
      const { action, userId, retentionDays } = job.data;

      logger.info({ jobId: job.id, action, userId }, 'Processing analytics job');

      switch (action) {
        case 'aggregate-usage': {
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

          const where = userId ? { userId } : {};

          const aggregation = await prisma.usageRecord.aggregate({
            where: {
              ...where,
              createdAt: { gte: startOfMonth, lte: endOfMonth },
            },
            _sum: { tokens: true, cost: true, duration: true },
            _count: true,
          });

          const totalCost = aggregation._sum.cost ?? 0;
          const totalTokens = aggregation._sum.tokens ?? 0;
          const totalDuration = aggregation._sum.duration ?? 0;
          const requestCount = aggregation._count;

          if (userId) {
            logger.info({ userId, totalCost, totalTokens, requestCount }, 'Usage aggregation completed for user');
          }
          break;
        }

        case 'cleanup-raw-data': {
          const retention = retentionDays ?? 90;
          const cutoff = new Date(Date.now() - retention * 24 * 60 * 60 * 1000);

          const deleteResult = await prisma.usageRecord.deleteMany({
            where: {
              ...(userId ? { userId } : {}),
              createdAt: { lt: cutoff },
            },
          });

          logger.info({ deletedCount: deleteResult.count, retentionDays: retention }, 'Raw usage data cleanup completed');
          break;
        }

        default:
          logger.warn({ action }, 'Unknown analytics action');
      }

      logger.info({ jobId: job.id, action }, 'Analytics job completed');
    },
    {
      connection: redisConnection,
      prefix: config.REDIS_PREFIX,
      concurrency: 2,
      lockDuration: 60000,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id, action: job?.data.action }, 'Analytics job failed');
  });

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id, action: job.data.action }, 'Analytics job completed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Analytics worker error');
  });

  return worker;
}

export async function closeAnalyticsWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
