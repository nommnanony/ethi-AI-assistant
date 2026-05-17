import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema } from 'zod';
import { errorService } from '../error-handling/error.service';
import { AppError } from '../error-handling/error.service';

export function validateRequest<T>(schema: ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      // Parse and validate request body
      request.body = schema.parse(request.body);
    } catch (error) {
      // Handle Zod validation errors
      if (error instanceof Error && 'errors' in error) {
        const zodError = error as ZodError;
        throw new AppError(
          'Invalid request data',
          400,
          'VALIDATION_ERROR',
          zodError.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          }))
        );
      }
      
      // Re-throw if not a Zod error
      throw error;
    }
  };
}

// Helper type for extracting validated data
export type ValidatedRequestBody<T> = T extends ZodSchema<infer U> ? U : never;

// Middleware for validating query parameters
export function validateQuery<T>(schema: ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      request.query = schema.parse(request.query);
    } catch (error) {
      if (error instanceof Error && 'errors' in error) {
        const zodError = error as ZodError;
        throw new AppError(
          'Invalid query parameters',
          400,
          'VALIDATION_ERROR',
          zodError.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          }))
        );
      }
      
      throw error;
    }
  };
}

// Middleware for validating route parameters
export function validateParams<T>(schema: ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      request.params = schema.parse(request.params);
    } catch (error) {
      if (error instanceof Error && 'errors' in error) {
        const zodError = error as ZodError;
        throw new AppError(
          'Invalid route parameters',
          400,
          'VALIDATION_ERROR',
          zodError.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          }))
        );
      }
      
      throw error;
    }
  };
}

// Middleware for validating headers
export function validateHeaders<T>(schema: ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      request.headers = schema.parse(request.headers);
    } catch (error) {
      if (error instanceof Error && 'errors' in error) {
        const zodError = error as ZodError;
        throw new AppError(
          'Invalid headers',
          400,
          'VALIDATION_ERROR',
          zodError.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          }))
        );
      }
      
      throw error;
    }
  };
}
