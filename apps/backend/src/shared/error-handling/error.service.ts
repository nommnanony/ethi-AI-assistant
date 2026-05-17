import type { FastifyInstance, FastifyError } from 'fastify';
import { ZodError } from 'zod';
import { logger } from '../logger/logger.service';

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

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not Found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too Many Requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

export class ErrorService {
  registerErrorHandler(app: FastifyInstance): void {
    app.setErrorHandler((error, request, reply) => {
      // Log error with correlation ID
      logger.error({
        err: error.message,
        stack: error.stack,
        correlationId: request.headers['x-correlation-id'] || 'none',
        url: request.url,
        method: request.method,
        ip: request.ip
      }, 'Error occurred');

      // Handle AppError and its subclasses
      if (error instanceof AppError) {
        return reply
          .code(error.statusCode)
          .send({
            error: error.name,
            message: error.message,
            code: error.code,
            details: error.details,
            correlationId: request.headers['x-correlation-id'] || 'none',
          });
      }

      // Handle Zod validation errors
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: 'Validation Error',
          message: 'Invalid request data',
          details: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
          correlationId: request.headers['x-correlation-id'] || 'none',
        });
      }

      // Handle Fastify validation errors
      if ((error as any).validation) {
        return reply.code(400).send({
          error: 'Request Validation Error',
          message: 'Invalid request schema',
          details: (error as any).validation.map((v: any) => ({
            path: v.instancePath || v.params?.missingProperty || '',
            message: v.message || 'Validation failed',
          })),
          correlationId: request.headers['x-correlation-id'] || 'none',
        });
      }

      // Handle rate limiting errors
      if (error.statusCode === 429 || error.code === 'FST_ERR_RATE_LIMIT') {
        return reply.code(429).send({
          error: 'Too Many Requests',
          message: error.message,
          retryAfter: reply.getHeader('retry-after') || undefined,
          correlationId: request.headers['x-correlation-id'] || 'none',
        });
      }

      // Handle HTTP errors with status codes < 500
      if (error.statusCode && error.statusCode < 500) {
        return reply.code(error.statusCode).send({
          error: error.name || 'Error',
          message: error.message,
          correlationId: request.headers['x-correlation-id'] || 'none',
        });
      }

      // Default to 500 for unexpected errors
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' 
          ? 'An unexpected error occurred' 
          : error.message,
        correlationId: request.headers['x-correlation-id'] || 'none',
      });
    });
  }
}

export const errorService = new ErrorService();
