import { z } from 'zod';

export const ZChatMessage = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
});

export const ZChatRequest = z.object({
  messages: z.array(ZChatMessage).min(1),
  provider: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
});

export const ZAIConfigUpdate = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  apiEndpoint: z.string().url().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  isDefault: z.boolean().optional(),
  isByok: z.boolean().optional(),
});

export type TChatMessage = z.infer<typeof ZChatMessage>;
export type TChatRequest = z.infer<typeof ZChatRequest>;
export type TAIConfigUpdate = z.infer<typeof ZAIConfigUpdate>;
