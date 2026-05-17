import { z } from 'zod';

export const startSessionSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  provider: z.enum(['deepgram', 'assemblyai', 'whisper']).default('deepgram'),
  language: z.string().default('en'),
  encoding: z.string().optional(),
  sampleRate: z.number().int().positive().optional(),
  channels: z.number().int().positive().optional(),
  model: z.string().optional(),
  punctuate: z.boolean().optional(),
  diarize: z.boolean().optional(),
  interimResults: z.boolean().optional(),
  keywords: z.array(z.string()).optional(),
});

export const audioChunkSchema = z.object({
  audio: z.string().min(1, 'Audio data is required'),
  encoding: z.string().optional(),
});

export const transcriptIdParamsSchema = z.object({
  id: z.string().uuid('Invalid transcript ID'),
});

export const listTranscriptsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELED']).optional(),
});

export const generateSummarySchema = z.object({
  model: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;
export type AudioChunkInput = z.infer<typeof audioChunkSchema>;
export type TranscriptIdParams = z.infer<typeof transcriptIdParamsSchema>;
export type ListTranscriptsQuery = z.infer<typeof listTranscriptsQuerySchema>;
export type GenerateSummaryInput = z.infer<typeof generateSummarySchema>;
