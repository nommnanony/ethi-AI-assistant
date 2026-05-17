import { z } from 'zod';

export const ZCreateWorkspace = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  slug: z.string().min(1).max(100).optional(),
});

export const ZUpdateWorkspace = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export const ZCreateFolder = z.object({
  name: z.string().min(1, 'Folder name is required').max(100),
  parentId: z.string().uuid().optional(),
});

export const ZCreatePrompt = z.object({
  name: z.string().min(1, 'Prompt name is required').max(200),
  content: z.string().min(1, 'Prompt content is required'),
  description: z.string().max(500).optional(),
  folderId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  isTemplate: z.boolean().optional(),
});

export const ZAddMember = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});

export type CreateWorkspaceInput = z.infer<typeof ZCreateWorkspace>;
export type UpdateWorkspaceInput = z.infer<typeof ZUpdateWorkspace>;
export type CreateFolderInput = z.infer<typeof ZCreateFolder>;
export type CreatePromptInput = z.infer<typeof ZCreatePrompt>;
export type AddMemberInput = z.infer<typeof ZAddMember>;
