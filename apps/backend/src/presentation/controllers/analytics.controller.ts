import type { FastifyRequest, FastifyReply } from 'fastify';
import { usageQuerySchema } from '../validators/analytics.validator';
import { analyticsApplicationService } from '../../application/services/analytics.service';
import { errorService } from '../../shared/error-handling/error.service';
import { AppError } from '../../shared/error-handling/error.service';
import { optionalAuth, getUserId } from '../../common/guards/auth.guard';

export class AnalyticsController {
  // Dashboard stats - no auth required
  async getDashboardStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = getUserId(request);
      
      reply.send({
        totalChats: 0,
        activeToday: 0,
        avgResponseTime: '0s',
        tokensUsed: 0,
        topModels: [],
        recentActivity: [],
        userId,
      });
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  // Analytics - optional auth
  async getUsageStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = getUserId(request);
      const query = usageQuerySchema.parse(request.query);
      const result = await analyticsApplicationService.getUsageStats(userId, query);
      reply.send(result);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async getSummary(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = getUserId(request);
      const result = await analyticsApplicationService.getSummary(userId);
      reply.send(result);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }
}

export const analyticsController = new AnalyticsController();
