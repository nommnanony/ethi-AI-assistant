import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

export function validateWith<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T => schema.parse(data);
}

export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    request.query = schema.parse(request.query) as any;
  };
}

export function validateParams<T>(schema: z.ZodSchema<T>) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    request.params = schema.parse(request.params) as any;
  };
}
