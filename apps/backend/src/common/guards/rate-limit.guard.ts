import type { FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyGenerator?: (request: FastifyRequest) => string;
  message?: string;
  statusCode?: number;
}

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

const defaultKeyGenerator = (request: FastifyRequest): string => {
  return request.ip;
};

function slidingWindowCleanup(entry: RateLimitEntry, windowMs: number) {
  const now = Date.now();
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
}

export function createRateLimitGuard(config: RateLimitConfig) {
  const {
    windowMs,
    max,
    keyGenerator = defaultKeyGenerator,
    message = 'Too many requests, please try again later',
    statusCode = 429,
  } = config;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const key = keyGenerator(request);
    const now = Date.now();

    let entry = store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      store.set(key, entry);
    }

    slidingWindowCleanup(entry, windowMs);

    if (entry.timestamps.length >= max) {
      const oldest = entry.timestamps[0];
      const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);

      reply.header('Retry-After', retryAfter);
      reply.header('X-RateLimit-Limit', max);
      reply.header('X-RateLimit-Remaining', 0);
      reply.header('X-RateLimit-Reset', Math.ceil((oldest + windowMs) / 1000));

      return reply.code(statusCode).send({
        error: 'Too Many Requests',
        message,
        retryAfter,
      });
    }

    entry.timestamps.push(now);

    reply.header('X-RateLimit-Limit', max);
    reply.header('X-RateLimit-Remaining', max - entry.timestamps.length);
    reply.header('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));
  };
}
