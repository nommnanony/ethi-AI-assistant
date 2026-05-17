import type { FastifyInstance } from 'fastify';
import { workspaceController } from '../../presentation/controllers/workspace.controller';
import { authGuard } from '../../common/guards/auth.guard';

export async function registerWorkspaceRoutes(app: FastifyInstance) {
  app.post('/api/workspaces', {
    preHandler: [authGuard],
    handler: workspaceController.createWorkspace,
  });

  app.get('/api/workspaces', {
    preHandler: [authGuard],
    handler: workspaceController.listWorkspaces,
  });

  app.get('/api/workspaces/:id', {
    preHandler: [authGuard],
    handler: workspaceController.getWorkspaceById,
  });

  app.patch('/api/workspaces/:id', {
    preHandler: [authGuard],
    handler: workspaceController.updateWorkspace,
  });

  app.delete('/api/workspaces/:id', {
    preHandler: [authGuard],
    handler: workspaceController.deleteWorkspace,
  });

  app.post('/api/workspaces/:id/members', {
    preHandler: [authGuard],
    handler: workspaceController.addMember,
  });

  app.delete('/api/workspaces/:id/members/:memberId', {
    preHandler: [authGuard],
    handler: workspaceController.removeMember,
  });

  app.patch('/api/workspaces/:id/members/:memberId', {
    preHandler: [authGuard],
    handler: workspaceController.updateMemberRole,
  });

  app.get('/api/workspaces/:id/folders', {
    preHandler: [authGuard],
    handler: workspaceController.getFolders,
  });

  app.post('/api/workspaces/:id/folders', {
    preHandler: [authGuard],
    handler: workspaceController.createFolder,
  });

  app.get('/api/workspaces/:id/prompts', {
    preHandler: [authGuard],
    handler: workspaceController.getPrompts,
  });

  app.post('/api/workspaces/:id/prompts', {
    preHandler: [authGuard],
    handler: workspaceController.createPrompt,
  });

  app.get('/api/workspaces/:id/chats', {
    preHandler: [authGuard],
    handler: workspaceController.getChats,
  });
}
