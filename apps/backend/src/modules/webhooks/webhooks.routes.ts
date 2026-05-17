import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { webhooksService } from './webhooks.service';
import { config } from '../../config/env';
import { logger } from '../../common/logger';

export async function registerWebhooksRoutes(app: FastifyInstance) {
  app.route({
    method: 'POST',
    url: '/api/webhooks/stripe',
    config: { rawBody: true } as any,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = request.headers['stripe-signature'] as string;
      if (!signature) {
        return reply.code(400).send({ error: 'Missing stripe-signature header' });
      }

      const rawBody = (request as any).rawBody as Buffer | undefined;
      if (!rawBody || rawBody.length === 0) {
        return reply.code(400).send({ error: 'Missing request body' });
      }

      try {
        const result = await webhooksService.handleStripeWebhook(rawBody, signature);
        return reply.code(200).send({ received: true, type: result.type });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Webhook processing failed';
        logger.error({ err }, 'Stripe webhook processing failed');
        return reply.code(400).send({ error: message });
      }
    },
  });
}
