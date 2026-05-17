import type { FastifyInstance } from 'fastify';
import { analyticsController } from '../../presentation/controllers/analytics.controller';
import { optionalAuth, getUserId } from '../../common/guards/auth.guard';

export async function registerAnalyticsRoutes(app: FastifyInstance) {
  // Dashboard stats - no auth required
  app.get('/api/stats/dashboard', {
    preHandler: [optionalAuth],
    handler: analyticsController.getDashboardStats,
  });

  // Analytics - optional auth
  app.get('/api/analytics/usage', {
    preHandler: [optionalAuth],
    handler: analyticsController.getUsageStats,
  });

  app.get('/api/analytics/summary', {
    preHandler: [optionalAuth],
    handler: analyticsController.getSummary,
  });
}
