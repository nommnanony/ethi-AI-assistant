import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { logger } from './logger';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: error.name,
        message: error.message,
        code: error.code,
        details: error.details,
      });
    }

    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'Validation Error',
        message: 'Invalid request data',
        details: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    if (error.validation) {
      return reply.code(400).send({
        error: 'Request Validation Error',
        message: 'Invalid request schema',
        details: error.validation.map((v) => ({
          path: v.instancePath || v.params?.missingProperty || '',
          message: v.message || 'Validation failed',
        })),
      });
    }

    if (error.statusCode === 429 || error.code === 'FST_ERR_RATE_LIMIT') {
      return reply.code(429).send({
        error: 'Too Many Requests',
        message: error.message,
        retryAfter: reply.getHeader('retry-after') || undefined,
      });
    }

    if (error.statusCode && error.statusCode < 500) {
      return reply.code(error.statusCode).send({
        error: error.name || 'Error',
        message: error.message,
      });
    }

    logger.error({ err: error }, 'Unhandled error');

    return reply.code(500).send({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
    });
  });
}
