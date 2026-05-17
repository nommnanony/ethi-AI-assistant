import { Worker } from 'bullmq';
import { config } from '../../config/env';
import { logger } from '../../common/logger';
import { NodemailerEmailProvider } from '../../providers/email/nodemailer.provider';
import { EmailTemplate } from '../../providers/email/types';
import { redisConnection } from '../queue';
import type { EmailJobData } from '../queue';

const emailProvider = new NodemailerEmailProvider();

const templateMap: Record<EmailJobData['type'], EmailTemplate> = {
  'welcome': EmailTemplate.Welcome,
  'magic-link': EmailTemplate.MagicLink,
  'password-reset': EmailTemplate.PasswordReset,
  'invoice': EmailTemplate.Invoice,
  'subscription-canceled': EmailTemplate.SubscriptionCanceled,
};

let worker: Worker<EmailJobData> | null = null;

export function createEmailWorker(): Worker<EmailJobData> {
  if (worker) return worker;

  worker = new Worker<EmailJobData>(
    'email',
    async (job) => {
      const { type, to, data } = job.data;
      const template = templateMap[type];

      logger.info({ jobId: job.id, type, to }, 'Processing email job');

      await emailProvider.sendTemplate(template, { ...data, email: to });

      logger.info({ jobId: job.id, type, to }, 'Email job completed');
    },
    {
      connection: redisConnection,
      prefix: config.REDIS_PREFIX,
      concurrency: 5,
      lockDuration: 30000,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id, type: job?.data.type, to: job?.data.to }, 'Email job failed');
  });

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id, type: job.data.type }, 'Email job completed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Email worker error');
  });

  return worker;
}

export async function closeEmailWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
