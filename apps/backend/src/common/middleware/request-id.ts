import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';

export function registerRequestIdMiddleware(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    const requestId = (request.headers['x-request-id'] as string) || nanoid(21);
    request.id = requestId;
    reply.header('X-Request-Id', requestId);
  });
}
