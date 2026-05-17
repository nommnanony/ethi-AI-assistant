import { z } from 'zod';

export const ZAIConfig = z.object({
  provider: z.enum(['OPENAI', 'ANTHROPIC', 'GEMINI', 'GROQ', 'OPENROUTER', 'OLLAMA', 'CUSTOM']),
  model: z.enum([
    'GPT_4O', 'GPT_4_TURBO', 'GPT_3_5_TURBO',
    'CLAUDE_3_OPUS', 'CLAUDE_3_SONNET', 'CLAUDE_3_HAIKU',
    'GEMINI_PRO', 'GEMINI_ULTRA',
    'GROQ_LLAMA3', 'GROQ_MIXTRAL',
    'OPENROUTER_AUTO', 'OLLAMA_CUSTOM',
  ]),
  apiKey: z.string().optional(),
  apiEndpoint: z.string().url().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(128000).default(4096),
  topP: z.number().min(0).max(1).default(1),
  isDefault: z.boolean().default(false),
  isByok: z.boolean().default(false),
});

export const ZChatMessage = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

export const ZChatRequest = z.object({
  messages: z.array(ZChatMessage).min(1),
  provider: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).optional(),
  stream: z.boolean().default(false),
});
