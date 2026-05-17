import type { FastifyRequest, FastifyReply } from 'fastify';
import { updateSubscriptionSchema, applyCouponSchema, paginationSchema } from '../validators/subscriptions.validator';
import { subscriptionsApplicationService } from '../../application/services/subscriptions.service';
import { errorService } from '../../shared/error-handling/error.service';
import { AppError } from '../../shared/error-handling/error.service';
import { authGuard } from '../../common/guards/auth.guard';

export class SubscriptionsController {
  async getCurrentSubscription(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const subscription = await subscriptionsApplicationService.getCurrentSubscription(userId);
      reply.send(subscription);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async listInvoices(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const pagination = paginationSchema.parse(request.query);
      const result = await subscriptionsApplicationService.listInvoices(userId, pagination);
      reply.send(result);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async applyCoupon(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const { code } = applyCouponSchema.parse(request.body);
      const result = await subscriptionsApplicationService.applyCoupon(userId, code);
      reply.send(result);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async updateSubscription(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const { tier } = updateSubscriptionSchema.parse(request.body);
      const result = await subscriptionsApplicationService.updateSubscription(userId, tier);
      reply.send(result);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async cancelSubscription(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const result = await subscriptionsApplicationService.cancelSubscription(userId);
      reply.send(result);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async resumeSubscription(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const result = await subscriptionsApplicationService.resumeSubscription(userId);
      reply.send(result);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }
}

export const subscriptionsController = new SubscriptionsController();
