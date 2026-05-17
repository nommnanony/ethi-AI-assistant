import { z } from 'zod';

export const ZChatRequest = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    })
  ),
  provider: z.enum(['openai', 'anthropic', 'gemini', 'groq', 'openrouter', 'ollama']).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
});

export const ZAIConfigUpdate = z.object({
  provider: z.enum(['openai', 'anthropic', 'gemini', 'groq', 'openrouter', 'ollama']).optional(),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  apiEndpoint: z.string().url().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  isDefault: z.boolean().optional(),
  isByok: z.boolean().optional(),
});