import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().minLength(8, 'Password must be at least 8 characters long'),
  name: z.string().optional()
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().minLength(1, 'Password is required')
});

export const refreshSchema = z.object({
  refreshToken: z.string().minLength(10, 'Invalid refresh token')
});

export const updateUserSchema = z.object({
  name: z.string().optional(),
  email: z.string().email('Invalid email format').optional()
});
