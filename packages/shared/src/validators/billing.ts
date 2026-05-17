import { z } from 'zod';

export const ZCreateCheckout = z.object({
  priceId: z.string(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
  trialDays: z.number().int().min(0).default(14),
});

export const ZApplyCoupon = z.object({
  code: z.string().min(1).max(50),
});
