import Stripe from 'stripe';
import { prisma } from '../../database/prisma/client';
import { StripePaymentProvider } from '../../providers/payment/stripe.provider';
import { logger } from '../../shared/logger/logger.service';
import { errorService } from '../../shared/error-handling/error.service';
import { AppError } from '../../shared/error-handling/error.service';
import { config } from '../../config/env';

const provider = new StripePaymentProvider();
const stripe = new Stripe(config.stripe.secretKey ?? '', {
  apiVersion: '2024-04-10',
  typescript: true,
});

const CREDIT_ALLOCATIONS: Record<string, number> = {
  FREE: 100,
  PRO: 1000,
  TEAM: 5000,
  ENTERPRISE: 50000,
};

export class PaymentsApplicationService {
  async getOrCreateCustomer(userId: string): Promise<string> {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      if (user.stripeCustomerId) return user.stripeCustomerId;

      const customer = await provider.createCustomer(user.email, user.name ?? undefined, { userId });
      await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
      logger.info({ userId, stripeCustomerId: customer.id }, 'Stripe customer created');
      return customer.id;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, userId }, 'Failed to get or create Stripe customer');
      throw new AppError('Failed to get or create Stripe customer', 500, 'STRIPE_CUSTOMER_FAILED');
    }
  }

  async createCheckoutSession(userId: string, input: { priceId: string; successUrl: string; cancelUrl: string; trialDays?: number; tier?: string }) {
    try {
      const customerId = await this.getOrCreateCustomer(userId);
      return provider.createCheckoutSession({
        priceId: input.priceId,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        customer: customerId,
        trialDays: input.trialDays ?? 14,
        metadata: { userId, tier: input.tier ?? 'PRO' },
      });
    } catch (error) {
      logger.error({ error, userId, input }, 'Failed to create checkout session');
      throw new AppError('Failed to create checkout session', 500, 'CHECKOUT_SESSION_CREATE_FAILED');
    }
  }

  async createPortalSession(userId: string, returnUrl?: string) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
      if (!user?.stripeCustomerId) throw new AppError('No Stripe customer found', 400, 'STRIPE_CUSTOMER_NOT_FOUND');
      return provider.createPortalSession(user.stripeCustomerId, { returnUrl });
    } catch (error) {
      logger.error({ error, userId }, 'Failed to create portal session');
      throw new AppError('Failed to create portal session', 500, 'PORTAL_SESSION_CREATE_FAILED');
    }
  }

  async createDonationSession(userId: string, amount: number, currency: string) {
    try {
      // Validate input
      if (!amount || amount < 1) {
        throw new AppError('Minimum donation is $1', 400, 'MINIMUM_DONATION');
      }
      
      const customerId = await this.getOrCreateCustomer(userId);
      return provider.createDonationSession({
        amount,
        currency: currency.toLowerCase(),
        customer: customerId,
        metadata: { userId },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, userId, amount, currency }, 'Failed to create donation session');
      throw new AppError('Failed to create donation session', 500, 'DONATION_SESSION_CREATE_FAILED');
    }
  }

  async handleWebhook(payload: Buffer, signature: string) {
    try {
      const result = await provider.handleWebhook(payload, signature);
      await this.processWebhookEvent(result.type, result.data);
      return result;
    } catch (error) {
      logger.error({ error }, 'Failed to handle webhook');
      throw new AppError('Failed to handle webhook', 500, 'WEBHOOK_HANDLE_FAILED');
    }
  }

  private async processWebhookEvent(type: string, data: Record<string, unknown>) {
    switch (type) {
      case 'checkout.session.completed':
        await this.handleCheckoutComplete(data);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(data);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(data);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(data);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(data);
        break;
    }
  }

  private async handleCheckoutComplete(data: Record<string, unknown>) {
    try {
      const userId = data.userId as string;
      const subscriptionId = data.subscriptionId as string;
      const tier = (data.tier as string) ?? 'PRO';
      if (!userId || !subscriptionId) return;

      const stripeSub = await provider.getSubscription(subscriptionId);
      const status = stripeSub.status;
      const prismaStatus = this.mapStripeStatus(status);
      const aiCredits = CREDIT_ALLOCATIONS[tier] ?? 100;

      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          tier: tier as any,
          status: prismaStatus as any,
          stripeSubscriptionId: subscriptionId,
          stripePriceId: stripeSub.items.data[0]?.price.id,
          currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          trialStart: stripeSub.trial_start ? new Date(stripeSub.trial_start * 1000) : null,
          trialEnd: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
          aiCredits,
          aiCreditsUsed: 0,
        },
        update: {
          status: prismaStatus as any,
          stripeSubscriptionId: subscriptionId,
          stripePriceId: stripeSub.items.data[0]?.price.id,
          currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          trialStart: stripeSub.trial_start ? new Date(stripeSub.trial_start * 1000) : null,
          trialEnd: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
          tier: tier as any,
          aiCredits,
          aiCreditsUsed: 0,
        },
      });

      logger.info({ userId, subscriptionId, tier }, 'Subscription synced from checkout');
    } catch (err) {
      logger.error({ err }, 'Failed to process checkout');
      // Don't throw as webhook should still return success to Stripe
    }
  }

  private async handleInvoicePaid(data: Record<string, unknown>) {
    try {
      const invoiceId = data.invoiceId as string;
      const subscriptionId = data.subscriptionId as string;
      const customerId = data.customerId as string;
      const amountPaid = (data.amountPaid as number) ?? 0;
      const currency = (data.currency as string) ?? 'usd';
      const paidAt = data.paidAt as string | null;

      if (!subscriptionId && !customerId) return;

      const subscription = subscriptionId
        ? await prisma.subscription.findFirst({ where: { stripeSubscriptionId: subscriptionId } })
        : null;

      if (subscription) {
        await prisma.invoice.create({
          data: {
            subscriptionId: subscription.id,
            stripeInvoiceId: invoiceId,
            amount: amountPaid,
            currency,
            status: 'paid',
            paidAt: paidAt ? new Date(paidAt) : new Date(),
            periodStart: subscription.currentPeriodStart,
            periodEnd: subscription.currentPeriodEnd,
          },
        });

        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { aiCreditsUsed: 0, aiCreditsResetAt: new Date() },
        });
      }
    } catch (err) {
      logger.error({ err }, 'Failed to process paid invoice');
      // Don't throw as webhook should still return success to Stripe
    }
  }

  private async handlePaymentFailed(data: Record<string, unknown>) {
    try {
      const invoiceId = data.invoiceId as string;
      const subscriptionId = data.subscriptionId as string;
      const nextPaymentAttempt = data.nextPaymentAttempt as number | null;

      if (!subscriptionId) return;

      const subscription = await prisma.subscription.findFirst({ where: { stripeSubscriptionId: subscriptionId } });
      if (subscription) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'PAST_DUE',
          },
        });
      }
    } catch (err) {
      logger.error({ err }, 'Failed to process payment failure');
      // Don't throw as webhook should still return success to Stripe
    }
  }

  private async handleSubscriptionUpdated(data: Record<string, unknown>) {
    try {
      const subscriptionId = data.subscriptionId as string;
      const status = data.status as string;
      const cancelAtPeriodEnd = data.cancelAtPeriodEnd as boolean;

      if (!subscriptionId) return;

      const prismaStatus = this.mapStripeStatus(status);
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscriptionId },
        data: {
          status: prismaStatus as any,
          cancelAtPeriodEnd: cancelAtPeriodEnd ?? false,
          ...(status === 'active' && !cancelAtPeriodEnd ? { canceledAt: null } : {}),
        },
      });
    } catch (err) {
      logger.error({ err }, 'Failed to update subscription');
      // Don't throw as webhook should still return success to Stripe
    }
  }

  private async handleSubscriptionDeleted(data: Record<string, unknown>) {
    try {
      const subscriptionId = data.subscriptionId as string;
      if (!subscriptionId) return;

      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscriptionId },
        data: { status: 'CANCELED', canceledAt: new Date() },
      });
    } catch (err) {
      logger.error({ err }, 'Failed to mark subscription deleted');
      // Don't throw as webhook should still return success to Stripe
    }
  }

  async syncSubscriptionFromStripe(userId: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
      if (!user?.stripeCustomerId) return;

      const subscriptions = await provider.listSubscriptions(user.stripeCustomerId);
      const active = subscriptions.find(s => ['active', 'trialing', 'past_due'].includes(s.status));
      if (!active) return;

      const tier = active.items.data[0]?.price.id === config.stripe.prices.team ? 'TEAM' : 'PRO';
      const aiCredits = CREDIT_ALLOCATIONS[tier] ?? 100;

      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          tier: tier as any,
          status: this.mapStripeStatus(active.status) as any,
          stripeSubscriptionId: active.id,
          stripePriceId: active.items.data[0]?.price.id,
          currentPeriodStart: new Date(active.current_period_start * 1000),
          currentPeriodEnd: new Date(active.current_period_end * 1000),
          trialStart: active.trial_start ? new Date(active.trial_start * 1000) : null,
          trialEnd: active.trial_end ? new Date(active.trial_end * 1000) : null,
          cancelAtPeriodEnd: active.cancel_at_period_end,
          aiCredits,
          aiCreditsUsed: 0,
        },
        update: {
          status: this.mapStripeStatus(active.status) as any,
          stripePriceId: active.items.data[0]?.price.id,
          currentPeriodStart: new Date(active.current_period_start * 1000),
          currentPeriodEnd: new Date(active.current_period_end * 1000),
          trialStart: active.trial_start ? new Date(active.trial_start * 1000) : null,
          trialEnd: active.trial_end ? new Date(active.trial_end * 1000) : null,
          cancelAtPeriodEnd: active.cancel_at_period_end,
        },
      });
    } catch (error) {
      logger.error({ error, userId }, 'Failed to sync subscription from Stripe');
      throw new AppError('Failed to sync subscription from Stripe', 500, 'STRIPE_SUBSCRIPTION_SYNC_FAILED');
    }
  }

  async checkAndDeductCredits(userId: string, amount: number): Promise<boolean> {
    try {
      const sub = await prisma.subscription.findUnique({ where: { userId } });
      if (!sub) return false;

      const remaining = sub.aiCredits - sub.aiCreditsUsed;
      if (remaining < amount) return false;

      await prisma.subscription.update({
        where: { userId },
        data: { aiCreditsUsed: { increment: amount } },
      });
      return true;
    } catch (error) {
      logger.error({ error, userId, amount }, 'Failed to check and deduct credits');
      throw new AppError('Failed to check and deduct credits', 500, 'CREDIT_CHECK_DEDUCT_FAILED');
    }
  }

  async getCreditBalance(userId: string) {
    try {
      const sub = await prisma.subscription.findUnique({ where: { userId } });
      if (!sub) return { total: 0, used: 0, remaining: 0 };
      return {
        total: sub.aiCredits,
        used: sub.aiCreditsUsed,
        remaining: Math.max(0, sub.aiCredits - sub.aiCreditsUsed),
      };
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get credit balance');
      throw new AppError('Failed to get credit balance', 500, 'CREDIT_BALANCE_FAILED');
    }
  }

  private mapStripeStatus(status: string): string {
    const map: Record<string, string> = {
      active: 'ACTIVE',
      canceled: 'CANCELED',
      incomplete: 'INCOMPLETE',
      incomplete_expired: 'INCOMPLETE_EXPIRED',
      past_due: 'PAST_DUE',
      trialing: 'TRIALING',
      unpaid: 'UNPAID',
    };
    return map[status] ?? 'ACTIVE';
  }
}

export const paymentsApplicationService = new PaymentsApplicationService();
