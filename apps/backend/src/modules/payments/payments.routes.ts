import type { FastifyInstance } from 'fastify';
import { paymentsController } from '../../presentation/controllers/payments.controller';
import { authGuard } from '../../common/guards/auth.guard';

export async function registerPaymentsRoutes(app: FastifyInstance) {
  app.addContentTypeParser('application/json', { parseAs: 'buffer', bodyLimit: 10 * 1024 * 1024 }, async (_request: any, body: Buffer) => {
    (_request as any).rawBody = body;
    try {
      return JSON.parse(body.toString());
    } catch {
      return null;
    }
  });

  app.post('/api/payments/checkout', {
    preHandler: [authGuard],
    handler: paymentsController.createCheckoutSession,
  });

  app.post('/api/payments/webhook', {
    handler: paymentsController.handleWebhook,
  });

  app.post('/api/payments/donate', {
    preHandler: [authGuard],
    handler: paymentsController.createDonationSession,
  });
}
