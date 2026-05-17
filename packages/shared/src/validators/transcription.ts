import { z } from 'zod';

export const ZStartTranscription = z.object({
  workspaceId: z.string().uuid().optional(),
  title: z.string().max(200).optional(),
  language: z.string().default('en'),
  provider: z.enum(['DEEPGRAM', 'ASSEMBLYAI', 'WHISPER', 'CUSTOM']).default('DEEPGRAM'),
});

export const ZStopTranscription = z.object({
  transcriptId: z.string().uuid(),
});
