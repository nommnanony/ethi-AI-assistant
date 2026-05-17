import { z } from 'zod';

export const stripeWebhookSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.record(z.unknown()),
  }),
  created: z.number(),
});

export type StripeWebhookPayload = z.infer<typeof stripeWebhookSchema>;
