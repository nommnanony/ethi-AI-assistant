import { prisma } from '../../database/prisma/client';
import { logger } from '../../shared/logger/logger.service';
import { errorService } from '../../shared/error-handling/error.service';
import { AppError } from '../../shared/error-handling/error.service';
import type { UsageQuery } from '../../modules/analytics/analytics.validator';

export class AnalyticsApplicationService {
  async getUsageStats(userId: string, query: UsageQuery) {
    try {
      const { startDate, endDate, granularity } = query;

      const where: Record<string, unknown> = { userId };
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
        if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
      }

      const records = await prisma.usageRecord.findMany({
        where,
        orderBy: { createdAt: 'asc' },
      });

      const grouped = new Map<string, { count: number; totalTokens: number; totalCost: number; totalDuration: number }>();

      for (const record of records) {
        const date = new Date(record.createdAt);
        let key: string;

        switch (granularity) {
          case 'hour':
            key = date.toISOString().slice(0, 13);
            break;
          case 'day':
            key = date.toISOString().slice(0, 10);
            break;
          case 'week': {
            const startOfWeek = new Date(date);
            startOfWeek.setDate(date.getDate() - date.getDay());
            key = startOfWeek.toISOString().slice(0, 10);
            break;
          }
          case 'month':
            key = date.toISOString().slice(0, 7);
            break;
          default:
            key = date.toISOString().slice(0, 10);
        }

        const current = grouped.get(key) || { count: 0, totalTokens: 0, totalCost: 0, totalDuration: 0 };
        current.count++;
        current.totalTokens += record.tokens || 0;
        current.totalCost += record.cost || 0;
        current.totalDuration += record.duration || 0;
        grouped.set(key, current);
      }

      return Array.from(grouped.entries()).map(([period, stats]) => ({
        period,
        ...stats,
      }));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, userId, query }, 'Failed to get usage stats');
      throw new AppError('Failed to retrieve usage statistics', 500, 'USAGE_STATS_FAILED');
    }
  }

  async getSummary(userId: string) {
    try {
      const [totalRequests, aggregation, recentActivity] = await Promise.all([
        prisma.usageRecord.count({ where: { userId } }),
        prisma.usageRecord.aggregate({
          where: { userId },
          _sum: { tokens: true, cost: true, duration: true },
        }),
        prisma.usageRecord.findMany({
          where: { userId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

      return {
        totalRequests,
        totalTokens: aggregation._sum.tokens ?? 0,
        totalCost: aggregation._sum.cost ?? 0,
        totalDuration: aggregation._sum.duration ?? 0,
        recentActivity,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, userId }, 'Failed to get analytics summary');
      throw new AppError('Failed to retrieve analytics summary', 500, 'ANALYTICS_SUMMARY_FAILED');
    }
  }

  async recordUsage(
    userId: string,
    type: string,
    tokens?: number,
    cost?: number,
    model?: string,
    provider?: string,
    duration?: number,
    metadata?: Record<string, unknown>
  ) {
    try {
      // Validate required fields
      if (!userId || userId.trim().length === 0) {
        throw new AppError('User ID is required', 400, 'USER_ID_REQUIRED');
      }
      
      if (!type || type.trim().length === 0) {
        throw new AppError('Usage type is required', 400, 'USAGE_TYPE_REQUIRED');
      }

      const record = await prisma.usageRecord.create({
        data: { 
          userId: userId.trim(), 
          type: type.trim(), 
          tokens, 
          cost, 
          model: model?.trim() || null, 
          provider: provider?.trim() || null, 
          duration, 
          metadata: metadata as any 
        },
      });
      
      logger.info({ userId, type, model }, 'Usage recorded');
      return record;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, userId, type }, 'Failed to record usage');
      throw new AppError('Failed to record usage', 500, 'USAGE_RECORD_FAILED');
    }
  }

  async getCostByModel(userId: string, startDate?: string, endDate?: string) {
    try {
      const where: Record<string, unknown> = { userId, cost: { not: null } };
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
        if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
      }

      const records = await prisma.usageRecord.findMany({
        where,
        select: { model: true, cost: true },
      });

      const byModel = new Map<string, number>();
      for (const r of records) {
        const model = r.model || 'unknown';
        byModel.set(model, (byModel.get(model) || 0) + (r.cost || 0));
      }

      return Array.from(byModel.entries()).map(([model, totalCost]) => ({ model, totalCost }));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, userId, startDate, endDate }, 'Failed to get cost by model');
      throw new AppError('Failed to retrieve cost by model', 500, 'COST_BY_MODEL_FAILED');
    }
  }

  async getTokensByDay(userId: string, startDate?: string, endDate?: string) {
    try {
      const where: Record<string, unknown> = { userId, tokens: { not: null } };
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
        if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
      }

      const records = await prisma.usageRecord.findMany({
        where,
        select: { tokens: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });

      const byDay = new Map<string, number>();
      for (const r of records) {
        const day = r.createdAt.toISOString().slice(0, 10);
        byDay.set(day, (byDay.get(day) || 0) + (r.tokens || 0));
      }

      return Array.from(byDay.entries()).map(([date, tokens]) => ({ date, tokens }));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, userId, startDate, endDate }, 'Failed to get tokens by day');
      throw new AppError('Failed to retrieve tokens by day', 500, 'TOKENS_BY_DAY_FAILED');
    }
  }
}

export const analyticsApplicationService = new AnalyticsApplicationService();
