import type { FastifyInstance } from 'fastify';
import { subscriptionsController } from '../../presentation/controllers/subscriptions.controller';
import { authGuard } from '../../common/guards/auth.guard';

export async function registerSubscriptionsRoutes(app: FastifyInstance) {
  app.get('/api/subscriptions/current', {
    preHandler: [authGuard],
    handler: subscriptionsController.getCurrentSubscription,
  });

  app.get('/api/subscriptions/invoices', {
    preHandler: [authGuard],
    handler: subscriptionsController.listInvoices,
  });

  app.post('/api/subscriptions/coupon', {
    preHandler: [authGuard],
    handler: subscriptionsController.applyCoupon,
  });

  app.put('/api/subscriptions/update', {
    preHandler: [authGuard],
    handler: subscriptionsController.updateSubscription,
  });

  app.post('/api/subscriptions/cancel', {
    preHandler: [authGuard],
    handler: subscriptionsController.cancelSubscription,
  });

  app.post('/api/subscriptions/resume', {
    preHandler: [authGuard],
    handler: subscriptionsController.resumeSubscription,
  });
}
