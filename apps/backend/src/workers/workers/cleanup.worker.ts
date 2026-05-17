import { Worker } from 'bullmq';
import prisma from '../../database/prisma/client';
import { config } from '../../config/env';
import { logger } from '../../common/logger';
import { redisConnection } from '../queue';
import type { CleanupJobData } from '../queue';

let worker: Worker<CleanupJobData> | null = null;

export function createCleanupWorker(): Worker<CleanupJobData> {
  if (worker) return worker;

  worker = new Worker<CleanupJobData>(
    'cleanup',
    async (job) => {
      const { type, dryRun } = job.data;

      logger.info({ jobId: job.id, type, dryRun }, 'Processing cleanup job');

      switch (type) {
        case 'expired-sessions': {
          const count = dryRun
            ? (await prisma.session.findMany({ where: { expiresAt: { lt: new Date() } }, select: { id: true } })).length
            : (await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })).count;
          logger.info({ count, dryRun }, 'Expired sessions cleanup');
          break;
        }

        case 'old-transcripts': {
          const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

          if (dryRun) {
            const count = await prisma.transcript.count({
              where: { deletedAt: null, createdAt: { lt: cutoff } },
            });
            logger.info({ count, dryRun }, 'Old transcripts found for soft-delete');
          } else {
            const result = await prisma.transcript.updateMany({
              where: { deletedAt: null, createdAt: { lt: cutoff } },
              data: { deletedAt: new Date() },
            });
            logger.info({ count: result.count }, 'Old transcripts soft-deleted');
          }
          break;
        }

        case 'reset-ai-credits': {
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

          if (dryRun) {
            const count = await prisma.subscription.count({
              where: { aiCreditsResetAt: { lt: startOfMonth } },
            });
            logger.info({ count, dryRun }, 'Users pending AI credits reset');
          } else {
            const result = await prisma.subscription.updateMany({
              where: { aiCreditsResetAt: { lt: startOfMonth } },
              data: {
                aiCreditsUsed: 0,
                aiCreditsResetAt: now,
              },
            });
            logger.info({ count: result.count }, 'Monthly AI credits reset completed');
          }
          break;
        }

        case 'expired-refresh-tokens': {
          const count = dryRun
            ? (await prisma.session.findMany({ where: { expiresAt: { lt: new Date() } }, select: { id: true } })).length
            : (await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })).count;
          logger.info({ count, dryRun }, 'Expired refresh tokens cleanup');
          break;
        }

        default:
          logger.warn({ type }, 'Unknown cleanup type');
      }

      logger.info({ jobId: job.id, type }, 'Cleanup job completed');
    },
    {
      connection: redisConnection,
      prefix: config.REDIS_PREFIX,
      concurrency: 1,
      lockDuration: 120000,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id, type: job?.data.type }, 'Cleanup job failed');
  });

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id, type: job.data.type }, 'Cleanup job completed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Cleanup worker error');
  });

  return worker;
}

export async function closeCleanupWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
