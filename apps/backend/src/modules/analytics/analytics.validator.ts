import { z } from 'zod';

export const usageQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
});

export type UsageQuery = z.infer<typeof usageQuerySchema>;
