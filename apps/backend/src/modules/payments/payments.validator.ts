import { z } from 'zod';

export const createCheckoutSchema = z.object({
  priceId: z.string().min(1, 'Price ID is required'),
  successUrl: z.string().url('Invalid success URL'),
  cancelUrl: z.string().url('Invalid cancel URL'),
  trialDays: z.coerce.number().int().positive().optional(),
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
