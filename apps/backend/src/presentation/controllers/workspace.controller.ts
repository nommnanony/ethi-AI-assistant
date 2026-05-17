import type { FastifyRequest, FastifyReply } from 'fastify';
import { 
  ZCreateWorkspace, 
  ZUpdateWorkspace, 
  ZCreateFolder, 
  ZCreatePrompt, 
  ZAddMember 
} from '../validators/workspace.validator';
import { workspaceApplicationService } from '../../application/services/workspace.service';
import { errorService } from '../../shared/error-handling/error.service';
import { AppError } from '../../shared/error-handling/error.service';
import { authGuard } from '../../common/guards/auth.guard';

export class WorkspaceController {
  async createWorkspace(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const input = ZCreateWorkspace.parse(request.body);
      const workspace = await workspaceApplicationService.create(userId, input);
      reply.code(201).send(workspace);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async listWorkspaces(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const workspaces = await workspaceApplicationService.list(userId);
      reply.send(workspaces);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async getWorkspaceById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const { id } = request.params as { id: string };
      const workspace = await workspaceApplicationService.getById(id, userId);
      reply.send(workspace);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async updateWorkspace(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const { id } = request.params as { id: string };
      const input = ZUpdateWorkspace.parse(request.body);
      const workspace = await workspaceApplicationService.update(id, userId, input);
      reply.send(workspace);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async deleteWorkspace(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const { id } = request.params as { id: string };
      await workspaceApplicationService.delete(id, userId);
      reply.code(204).send();
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async addMember(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const { id } = request.params as { id: string };
      const { email, role } = ZAddMember.parse(request.body);
      const member = await workspaceApplicationService.addMember(id, userId, email, role);
      reply.code(201).send(member);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async removeMember(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const { id, memberId } = request.params as { id: string; memberId: string };
      await workspaceApplicationService.removeMember(id, userId, memberId);
      reply.code(204).send();
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async updateMemberRole(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const { id, memberId } = request.params as { id: string; memberId: string };
      const { role } = ZAddMember.pick({ role: true }).parse(request.body);
      const updatedMember = await workspaceApplicationService.updateMemberRole(id, userId, memberId, role);
      reply.send(updatedMember);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async getFolders(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const { id } = request.params as { id: string };
      const folders = await workspaceApplicationService.getFolders(id, userId);
      reply.send(folders);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async createFolder(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const { id } = request.params as { id: string };
      const input = ZCreateFolder.parse(request.body);
      const folder = await workspaceApplicationService.createFolder(id, userId, input);
      reply.code(201).send(folder);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async getPrompts(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const { id } = request.params as { id: string };
      const prompts = await workspaceApplicationService.getPrompts(id, userId);
      reply.send(prompts);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async createPrompt(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const { id } = request.params as { id: string };
      const input = ZCreatePrompt.parse(request.body);
      const prompt = await workspaceApplicationService.createPrompt(id, userId, input);
      reply.code(201).send(prompt);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async getChats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const { id } = request.params as { id: string };
      const chats = await workspaceApplicationService.getChats(id, userId);
      reply.send(chats);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }
}

export const workspaceController = new WorkspaceController();
