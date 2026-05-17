import { z } from 'zod';

export const ZRegisterInput = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Min 8 characters').max(128),
  name: z.string().min(1).max(100).optional(),
});

export const ZLoginInput = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

export const ZRefreshInput = z.object({
  refreshToken: z.string().optional(),
});

export const ZUpdateProfile = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional().nullable(),
});
