import Stripe from 'stripe';
import { config } from '../../config/env';
import { logger } from '../../common/logger';
import { AppError } from '../../common/error-handler';
import type { PaymentProvider, CreateCheckoutSessionOptions, CreatePortalSessionOptions, CheckoutSessionResult, PortalSessionResult, WebhookResult, CreateCouponOptions, InvoiceResult, PaymentMethodResult, TaxRateResult } from './types';

export class StripePaymentProvider implements PaymentProvider {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(config.stripe.secretKey ?? '', {
      apiVersion: '2024-04-10',
      typescript: true,
      maxNetworkRetries: 3,
    });
  }

  async createCustomer(email: string, name?: string, metadata?: Record<string, string>): Promise<Stripe.Customer> {
    return this.stripe.customers.create({ email, name, metadata });
  }

  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    return this.stripe.customers.retrieve(customerId) as Promise<Stripe.Customer>;
  }

  async createCheckoutSession(options: CreateCheckoutSessionOptions): Promise<CheckoutSessionResult> {
    const { priceId, successUrl, cancelUrl, customer, trialDays, metadata } = options;
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: options.quantity ?? 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer,
      metadata,
      subscription_data: {
        trial_period_days: trialDays,
        metadata,
      },
      allow_promotion_codes: true,
      tax_id_collection: { enabled: true },
      automatic_tax: { enabled: true },
      billing_address_collection: 'required',
      payment_method_collection: 'always',
      custom_text: {
        submit: { message: 'We will use your subscription to provide AI assistant services.' },
      },
    });
    logger.info({ sessionId: session.id, customer }, 'Checkout session created');
    return { url: session.url, sessionId: session.id };
  }

  async createPortalSession(customerId: string, options?: CreatePortalSessionOptions): Promise<PortalSessionResult> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: options?.returnUrl ?? `${config.CORS_ORIGIN}/settings/billing`,
      flow_data: options?.flowData as any,
    });
    logger.info({ customerId }, 'Portal session created');
    return { url: session.url };
  }

  async createDonationSession(options: { amount: number; currency: string; customer: string; metadata?: Record<string, string> }): Promise<{ url: string; sessionId: string }> {
    const { amount, currency, customer, metadata } = options;
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: 'Donation to Ethi AI',
            description: 'Support the project',
          },
        },
      }],
      success_url: `${config.CORS_ORIGIN}/donate?success=true`,
      cancel_url: `${config.CORS_ORIGIN}/donate?canceled=true`,
      customer,
      metadata: { ...metadata, type: 'donation' },
      custom_text: {
        submit: { message: 'Thank you for your support!' },
      },
    });
    logger.info({ sessionId: session.id, amount, currency, customer }, 'Donation session created');
    return { url: session.url ?? '', sessionId: session.id };
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<WebhookResult> {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, config.stripe.webhookSecret ?? '');
    } catch (err) {
      throw new AppError('Webhook signature verification failed', 400, 'WEBHOOK_VERIFICATION_FAILED');
    }

    logger.info({ type: event.type, id: event.id }, 'Webhook received');

    let data: Record<string, unknown> = {};

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        data = {
          sessionId: session.id,
          customerId: session.customer as string,
          subscriptionId: session.subscription as string,
          userId: session.metadata?.userId,
          tier: session.metadata?.tier,
        };
        break;
      }
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        data = { sessionId: session.id, customerId: session.customer as string };
        break;
      }
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session;
        data = { sessionId: session.id, customerId: session.customer as string };
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        data = {
          invoiceId: invoice.id,
          customerId: invoice.customer as string,
          subscriptionId: invoice.subscription as string,
          amountPaid: invoice.amount_paid,
          currency: invoice.currency,
          status: invoice.status,
          paidAt: invoice.status_transitions?.paid_at,
          lines: invoice.lines.data.map(l => ({ price: l.price?.id, amount: l.amount, description: l.description })),
        };
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        data = {
          invoiceId: invoice.id,
          customerId: invoice.customer as string,
          subscriptionId: invoice.subscription as string,
          amountDue: invoice.amount_due,
          attemptCount: invoice.attempt_count,
          nextPaymentAttempt: invoice.next_payment_attempt,
        };
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        data = {
          subscriptionId: subscription.id,
          customerId: subscription.customer as string,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          items: subscription.items.data.map(i => ({ priceId: i.price.id, quantity: i.quantity })),
        };
        break;
      }
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        data = {
          subscriptionId: subscription.id,
          customerId: subscription.customer as string,
          status: subscription.status,
          items: subscription.items.data.map(i => ({ priceId: i.price.id, quantity: i.quantity })),
        };
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        data = { subscriptionId: subscription.id, customerId: subscription.customer as string };
        break;
      }
      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;
        data = { subscriptionId: subscription.id, customerId: subscription.customer as string };
        break;
      }
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        data = { paymentIntentId: pi.id, customerId: pi.customer as string, amount: pi.amount };
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        data = { paymentIntentId: pi.id, customerId: pi.customer as string, lastPaymentError: pi.last_payment_error?.message };
        break;
      }
      default:
        logger.info({ type: event.type }, 'Unhandled webhook event type');
    }

    return { type: event.type, data };
  }

  async cancelSubscription(subscriptionId: string, immediate = false): Promise<void> {
    if (immediate) {
      await this.stripe.subscriptions.cancel(subscriptionId);
      logger.info({ subscriptionId }, 'Subscription canceled immediately');
    } else {
      await this.stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
      logger.info({ subscriptionId }, 'Subscription set to cancel at period end');
    }
  }

  async resumeSubscription(subscriptionId: string): Promise<void> {
    await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
    logger.info({ subscriptionId }, 'Subscription resumed');
  }

  async updateSubscriptionItem(subscriptionId: string, itemId: string, priceId: string, quantity?: number): Promise<void> {
    const updateParams: Stripe.SubscriptionUpdateParams = {
      items: [{ id: itemId, price: priceId, quantity }],
      proration_behavior: 'create_prorations',
    };
    await this.stripe.subscriptions.update(subscriptionId, updateParams);
    logger.info({ subscriptionId, priceId }, 'Subscription item updated');
  }

  async listInvoices(customerId: string, limit = 100): Promise<InvoiceResult[]> {
    const invoices = await this.stripe.invoices.list({ customer: customerId, limit });
    return invoices.data.map(inv => ({
      id: inv.id,
      amount: inv.amount_paid,
      currency: inv.currency,
      status: inv.status ?? 'unknown',
      paidAt: inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000).toISOString() : null,
      periodStart: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
      periodEnd: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
      pdfUrl: inv.invoice_pdf ?? null,
      number: inv.number,
      lines: inv.lines.data.map(l => ({
        description: l.description,
        amount: l.amount,
        priceId: l.price?.id,
      })),
    }));
  }

  async createCoupon(options: CreateCouponOptions): Promise<Stripe.Coupon> {
    return this.stripe.coupons.create({
      percent_off: options.percentOff,
      amount_off: options.amountOff,
      currency: options.currency,
      duration: options.duration ?? 'once',
      duration_in_months: options.durationInMonths,
      max_redemptions: options.maxRedemptions,
      name: options.name,
      metadata: options.metadata,
    });
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }

  async listSubscriptions(customerId: string): Promise<Stripe.Subscription[]> {
    const subs = await this.stripe.subscriptions.list({ customer: customerId, limit: 100 });
    return subs.data;
  }

  async getUsageRecordSummaries(subscriptionItemId: string): Promise<Stripe.UsageRecordSummary[]> {
    const summaries = await this.stripe.subscriptionItems.listUsageRecordSummaries(subscriptionItemId);
    return summaries.data;
  }

  async createUsageRecord(subscriptionItemId: string, quantity: number, timestamp?: number): Promise<Stripe.UsageRecord> {
    return (this.stripe as any).usageRecords.create(subscriptionItemId, {
      quantity,
      timestamp: timestamp ?? Math.floor(Date.now() / 1000),
      action: 'increment',
    });
  }

  async getTaxRates(): Promise<TaxRateResult[]> {
    const rates = await this.stripe.taxRates.list({ active: true, limit: 100 });
    return rates.data.map(r => ({ id: r.id, percentage: r.percentage, description: r.description ?? '', jurisdiction: r.jurisdiction ?? '', inclusive: r.inclusive }));
  }
}
