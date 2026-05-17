import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { config } from '../../config/env';

export const redisConnection = new Redis(config.REDIS_URL);

export const aiQueue = new Queue('ai-processing', {
  connection: redisConnection,
});

export const transcriptionQueue = new Queue('transcription-processing', {
  connection: redisConnection,
});

export default { redisConnection, aiQueue, transcriptionQueue };