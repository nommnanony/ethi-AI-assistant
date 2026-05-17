import type { FastifyRequest, FastifyReply } from 'fastify';
import { createCheckoutSchema } from '../validators/payments.validator';
import { paymentsApplicationService } from '../../application/services/payments.service';
import { errorService } from '../../shared/error-handling/error.service';
import { AppError } from '../../shared/error-handling/error.service';
import { authGuard } from '../../common/guards/auth.guard';

export class PaymentsController {
  async createCheckoutSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const input = createCheckoutSchema.parse(request.body);
      const result = await paymentsApplicationService.createCheckoutSession(userId, input);
      reply.code(201).send(result);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async handleWebhook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Parse raw body and signature
      const signature = request.headers['stripe-signature'] as string;
      if (!signature) {
        throw new AppError('Missing stripe-signature header', 400, 'MISSING_STRIPE_SIGNATURE');
      }

      // Get raw body from request (set by content type parser)
      const rawBody = (request as any).rawBody as Buffer | undefined;
      if (!rawBody) {
        throw new AppError('Missing request body', 400, 'MISSING_REQUEST_BODY');
      }

      const result = await paymentsApplicationService.handleWebhook(rawBody, signature);
      reply.send({ received: true, type: result.type });
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async createDonationSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const { amount, currency = 'usd' } = request.body as { amount: number; currency?: string };
      if (!amount || amount < 1) {
        throw new AppError('Minimum donation is $1', 400, 'MINIMUM_DONATION');
      }
      const result = await paymentsApplicationService.createDonationSession(
        userId,
        amount,
        currency.toUpperCase()
      );
      reply.code(201).send(result);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }
}

export const paymentsController = new PaymentsController();
