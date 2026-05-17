import type { FastifyInstance } from 'fastify';

export function notFoundHandler(app: FastifyInstance) {
  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({
      error: 'Not Found',
      message: 'The requested resource was not found',
    });
  });
}

export function methodNotAllowedHandler(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS') {
      return;
    }

    if (reply.statusCode === 405) {
      return reply.code(405).send({
        error: 'Method Not Allowed',
        message: `The ${request.method} method is not allowed for this route`,
      });
    }
  });
}
