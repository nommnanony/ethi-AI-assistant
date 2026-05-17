import { logger } from '../../common/logger';
import { paymentsApplicationService } from '../../application/services/payments.service';
import type { WebhookResult } from '../../providers/payment/types';

export class WebhooksService {
  async handleStripeWebhook(payload: Buffer, signature: string): Promise<WebhookResult> {
    const result = await paymentsService.handleWebhook(payload, signature);
    logger.info({ type: result.type }, 'Stripe webhook processed via payments service');
    return result;
  }

  async handleEvent(type: string, data: Record<string, unknown>): Promise<void> {
    logger.info({ type }, 'Processing webhook event');

    switch (type) {
      case 'checkout.session.completed':
        logger.info({ data }, 'Checkout session completed');
        break;
      case 'checkout.session.async_payment_succeeded':
        logger.info({ data }, 'Async payment succeeded');
        break;
      case 'checkout.session.async_payment_failed':
        logger.warn({ data }, 'Async payment failed');
        break;
      case 'invoice.paid':
        logger.info({ data }, 'Invoice paid');
        break;
      case 'invoice.payment_failed':
        logger.warn({ data }, 'Invoice payment failed');
        break;
      case 'customer.subscription.created':
        logger.info({ data }, 'Subscription created');
        break;
      case 'customer.subscription.updated':
        logger.info({ data }, 'Subscription updated');
        break;
      case 'customer.subscription.deleted':
        logger.info({ data }, 'Subscription deleted');
        break;
      case 'customer.subscription.trial_will_end':
        logger.info({ data }, 'Trial will end');
        break;
      case 'payment_intent.succeeded':
        logger.info({ data }, 'Payment intent succeeded');
        break;
      case 'payment_intent.payment_failed':
        logger.warn({ data }, 'Payment intent failed');
        break;
      default:
        logger.info({ type }, 'Unhandled webhook event');
    }
  }
}

export const webhooksService = new WebhooksService();
