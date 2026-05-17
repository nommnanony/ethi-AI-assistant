import Stripe from 'stripe';
import prisma from '../../database/prisma/client';
import { StripePaymentProvider } from '../../providers/payment/stripe.provider';
import { paymentsService } from '../payments/payments.service';
import { config } from '../../config/env';
import { AppError } from '../../common/error-handler';
import { logger } from '../../common/logger';

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

export class SubscriptionsService {
  async getCurrentSubscription(userId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new AppError('Subscription not found', 404);
    }

    const aiCreditsRemaining = subscription.aiCredits - subscription.aiCreditsUsed;

    return {
      ...subscription,
      aiCreditsRemaining: Math.max(0, aiCreditsRemaining),
    };
  }

  async listInvoices(userId: string, pagination: { page: number; limit: number }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscription: { select: { id: true } } },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: { subscriptionId: user.subscription?.id ?? '' },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.invoice.count({
        where: { subscriptionId: user.subscription?.id ?? '' },
      }),
    ]);

    return {
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async applyCoupon(userId: string, code: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const coupon = await prisma.coupon.findUnique({
      where: { code },
    });

    if (!coupon || !coupon.isActive) {
      throw new AppError('Invalid or expired coupon', 400);
    }

    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new AppError('Coupon has expired', 400);
    }

    if (coupon.maxRedemptions && coupon.currentRedemptions >= coupon.maxRedemptions) {
      throw new AppError('Coupon usage limit reached', 400);
    }

    if (user.stripeCustomerId) {
      try {
        const stripeCoupons = await stripe.coupons.list({ limit: 100 });
        let stripeCoupon = stripeCoupons.data.find((c) => c.name === code || c.id === code);

        if (!stripeCoupon) {
          stripeCoupon = await stripe.coupons.create({
            percent_off: coupon.discountPercent ?? undefined,
            amount_off: coupon.discountAmount ?? undefined,
            currency: 'usd',
            duration: 'once',
            name: coupon.code,
          });
        }

        await stripe.customers.update(user.stripeCustomerId, {
          coupon: stripeCoupon.id,
        });

        await prisma.coupon.update({
          where: { id: coupon.id },
          data: { currentRedemptions: { increment: 1 } },
        });

        logger.info({ userId, code }, 'Coupon applied');
      } catch (error) {
        logger.error({ err: error, userId, code }, 'Failed to apply coupon');
        throw new AppError('Failed to apply coupon', 500);
      }
    }

    return { message: 'Coupon applied successfully' };
  }

  async updateSubscription(userId: string, tier: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscription: { select: { id: true, stripeSubscriptionId: true, stripePriceId: true } },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!user.subscription?.stripeSubscriptionId) {
      throw new AppError('No active subscription to update', 400);
    }

    const priceId =
      tier === 'PRO'
        ? config.stripe.prices.pro
        : tier === 'TEAM'
          ? config.stripe.prices.team
          : null;

    if (!priceId) {
      throw new AppError(`No price configured for tier: ${tier}`, 400);
    }

    try {
      const subscription = await stripe.subscriptions.retrieve(user.subscription.stripeSubscriptionId);
      const subscriptionItemId = subscription.items.data[0]?.id;

      if (subscriptionItemId) {
        await stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
          items: [{ id: subscriptionItemId, price: priceId }],
          proration_behavior: 'create_prorations',
        });
      }

      const aiCredits = CREDIT_ALLOCATIONS[tier] ?? 100;

      await prisma.subscription.update({
        where: { id: user.subscription.id },
        data: {
          tier: tier as any,
          stripePriceId: priceId,
          aiCredits,
          aiCreditsUsed: 0,
        },
      });

      logger.info({ userId, tier }, 'Subscription tier updated');
    } catch (error) {
      logger.error({ err: error, userId, tier }, 'Failed to update subscription');
      throw new AppError('Failed to update subscription', 500);
    }

    return { message: 'Subscription updated successfully', tier };
  }

  async cancelSubscription(userId: string, immediate = false) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscription: { select: { id: true, stripeSubscriptionId: true } },
      },
    });

    if (!user?.subscription?.stripeSubscriptionId) {
      throw new AppError('No active subscription to cancel', 400);
    }

    await provider.cancelSubscription(user.subscription.stripeSubscriptionId, immediate);

    await prisma.subscription.update({
      where: { id: user.subscription.id },
      data: {
        cancelAtPeriodEnd: !immediate,
        canceledAt: new Date(),
        status: immediate ? 'CANCELED' : undefined,
      },
    });

    logger.info({ userId, immediate }, 'Subscription canceled');

    return {
      message: immediate
        ? 'Subscription canceled immediately'
        : 'Subscription will be canceled at the end of the billing period',
    };
  }

  async resumeSubscription(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscription: { select: { id: true, stripeSubscriptionId: true, cancelAtPeriodEnd: true } },
      },
    });

    if (!user?.subscription?.stripeSubscriptionId) {
      throw new AppError('No subscription to resume', 400);
    }

    if (!user.subscription.cancelAtPeriodEnd) {
      throw new AppError('Subscription is not scheduled for cancellation', 400);
    }

    try {
      await provider.resumeSubscription(user.subscription.stripeSubscriptionId);

      await prisma.subscription.update({
        where: { id: user.subscription.id },
        data: {
          cancelAtPeriodEnd: false,
          canceledAt: null,
        },
      });

      logger.info({ userId }, 'Subscription resumed');
    } catch (error) {
      logger.error({ err: error, userId }, 'Failed to resume subscription');
      throw new AppError('Failed to resume subscription', 500);
    }

    return { message: 'Subscription resumed successfully' };
  }

  async resetAiCredits() {
    const result = await prisma.subscription.updateMany({
      where: {
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      data: {
        aiCreditsUsed: 0,
        aiCreditsResetAt: new Date(),
      },
    });

    logger.info({ count: result.count }, 'AI credits reset for all active subscriptions');

    return { count: result.count };
  }

  async getUsageSummary(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const subscription = await prisma.subscription.findUnique({ where: { userId } });
    if (!subscription) throw new AppError('No subscription found', 404);

    const monthlyUsage = await prisma.usageRecord.aggregate({
      where: {
        userId,
        createdAt: { gte: startOfMonth },
      },
      _sum: { tokens: true, cost: true },
      _count: true,
    });

    const totalCredits = subscription.aiCredits;
    const usedCredits = subscription.aiCreditsUsed;
    const remainingCredits = Math.max(0, totalCredits - usedCredits);
    const usagePercent = totalCredits > 0 ? Math.round((usedCredits / totalCredits) * 100) : 0;

    return {
      tier: subscription.tier,
      status: subscription.status,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      credits: {
        total: totalCredits,
        used: usedCredits,
        remaining: remainingCredits,
        usagePercent,
        resetAt: subscription.aiCreditsResetAt,
      },
      monthlyUsage: {
        totalTokens: monthlyUsage._sum.tokens ?? 0,
        totalCost: monthlyUsage._sum.cost ?? 0,
        totalRequests: monthlyUsage._count,
      },
    };
  }

  async getTeamSeats(userId: string) {
    const subscription = await prisma.subscription.findUnique({ where: { userId } });
    if (!subscription) throw new AppError('No subscription found', 404);

    if (subscription.tier !== 'TEAM' && subscription.tier !== 'ENTERPRISE') {
      throw new AppError('Team seats only available for TEAM and ENTERPRISE plans', 400);
    }

    const workspace = await prisma.workspace.findFirst({
      where: { ownerId: userId },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
        },
      },
    });

    if (!workspace) {
      return { seats: { total: 0, used: 0, members: [] } };
    }

    const totalSeats = subscription.tier === 'ENTERPRISE' ? 1000 : 10;
    const usedSeats = workspace.members.length;

    return {
      seats: {
        total: totalSeats,
        used: usedSeats,
        available: Math.max(0, totalSeats - usedSeats),
      },
      members: workspace.members.map(m => ({
        id: m.user.id,
        email: m.user.email,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    };
  }
}

export const subscriptionsService = new SubscriptionsService();
