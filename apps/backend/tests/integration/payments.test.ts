import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';

vi.mock('../../src/database/prisma/client.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    invoice: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../../src/shared/logger/logger.service', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../src/config/env.js', () => ({
  config: {
    LOG_LEVEL: 'info',
    NODE_ENV: 'test',
    isDev: false,
    isProd: false,
    isTest: true,
    jwt: {
      secret: 'test-secret-32-characters-long-for-testing!!',
    },
    stripe: {
      secretKey: 'sk_test_xxx',
      webhookSecret: 'whsec_xxx',
      prices: {
        pro: 'price_pro',
        team: 'price_team',
      },
    },
  },
}));

vi.mock('../../src/providers/payment/stripe.provider.js', () => ({
  StripePaymentProvider: class {
    createCustomer = vi.fn().mockResolvedValue({ id: 'cus_test123' });
    createCheckoutSession = vi.fn().mockResolvedValue({ id: 'cs_test', url: 'https://checkout.stripe.com/test' });
    createDonationSession = vi.fn().mockResolvedValue({ id: 'cs_donate', url: 'https://checkout.stripe.com/donate' });
    handleWebhook = vi.fn().mockResolvedValue({ type: 'checkout.session.completed', data: {} });
    createPortalSession = vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/portal' });
  },
}));

import { registerPaymentsRoutes } from '../../src/modules/payments/payments.routes.js';
import prisma from '../../src/database/prisma/client.js';

describe('Payments API Integration', () => {
  const app = Fastify();

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    stripeCustomerId: null,
  };

  beforeAll(async () => {
    await registerPaymentsRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(jwt, 'verify').mockReturnValue({ sub: 'user-1', email: 'test@example.com', role: 'USER' } as never);
  });

  describe('POST /api/payments/checkout', () => {
    it('should create checkout session and return 201', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        ...mockUser,
        stripeCustomerId: 'cus_test123',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/checkout',
        headers: { authorization: 'Bearer mock-token' },
         payload: {
           priceId: 'price_pro',
           successUrl: 'https://app.ethi-ai/success',
           cancelUrl: 'https://app.ethi-ai/cancel',
           tier: 'PRO',
         },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBe('cs_test');
      expect(body.url).toBe('https://checkout.stripe.com/test');
    });

    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/checkout',
        payload: {
          priceId: 'price_pro',
          successUrl: 'https://app.ethi-ai/success',
          cancelUrl: 'https://app.ethi-ai/cancel',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/checkout',
        payload: {
          priceId: 'price_pro',
          successUrl: 'https://app.ethi-ai/success',
          cancelUrl: 'https://app.ethi-ai/cancel',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/payments/donate', () => {
    it('should create donation session and return 201', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        ...mockUser,
        stripeCustomerId: 'cus_test123',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/donate',
        headers: { authorization: 'Bearer mock-token' },
        payload: {
          amount: 50,
          currency: 'usd',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBe('cs_donate');
      expect(body.url).toBe('https://checkout.stripe.com/donate');
    });

    it('should return 400 for amount below minimum', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/donate',
        headers: { authorization: 'Bearer mock-token' },
        payload: {
          amount: 0.5,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).message).toBe('Minimum donation is $1');
    });

    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/donate',
        payload: {
          amount: 50,
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/payments/webhook', () => {
    it('should handle webhook and return 200', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/webhook',
        headers: {
          'stripe-signature': 'sig_test_123',
        },
        payload: { type: 'checkout.session.completed' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.received).toBe(true);
    });

    it('should return 400 without signature', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/webhook',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });
});