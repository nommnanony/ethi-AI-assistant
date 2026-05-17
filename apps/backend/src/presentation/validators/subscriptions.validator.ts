import { z } from 'zod';

export const updateSubscriptionSchema = z.object({
  tier: z.enum(['FREE', 'PRO', 'TEAM', 'ENTERPRISE']),
});

export const applyCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required'),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
