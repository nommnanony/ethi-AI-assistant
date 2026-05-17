import { z } from 'zod';

export const ZCreateWorkspace = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const ZUpdateWorkspace = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
});

export const ZCreateFolder = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().uuid().optional(),
});

export const ZCreatePrompt = z.object({
  name: z.string().min(1).max(200),
  content: z.string().min(1),
  description: z.string().max(500).optional(),
  variables: z.record(z.string()).optional(),
  tags: z.array(z.string()).default([]),
  folderId: z.string().uuid().optional(),
  isPublic: z.boolean().default(false),
  isTemplate: z.boolean().default(false),
});
