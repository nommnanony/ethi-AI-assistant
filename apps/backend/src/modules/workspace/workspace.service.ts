import { randomBytes } from 'crypto';
import prisma from '../../database/prisma/client';
import { AppError } from '../../common/error-handler';
import { logger } from '../../common/logger';
import type { CreateWorkspaceInput, UpdateWorkspaceInput, CreateFolderInput, CreatePromptInput, AddMemberInput } from './workspace.validator';

export class WorkspaceService {
  async create(userId: string, input: CreateWorkspaceInput) {
    const slug = input.slug || input.name.toLowerCase().replace(/\s+/g, '-') + '-' + randomBytes(4).toString('hex');

    const existing = await prisma.workspace.findUnique({ where: { slug } });
    if (existing) {
      throw new AppError('Workspace slug already taken', 409);
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: input.name,
        description: input.description,
        slug,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
        },
      },
    });

    logger.info({ workspaceId: workspace.id, userId }, 'Workspace created');
    return workspace;
  }

  async list(userId: string) {
    return prisma.workspace.findMany({
      where: {
        deletedAt: null,
        members: { some: { userId } },
      },
      include: {
        _count: { select: { members: true } },
        owner: { select: { id: true, email: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getById(workspaceId: string, userId: string) {
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      include: {
        owner: { select: { id: true, email: true, name: true, avatarUrl: true } },
        members: {
          include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
          orderBy: { joinedAt: 'asc' },
        },
        _count: { select: { folders: true, prompts: true, chats: true } },
      },
    });

    if (!workspace) {
      throw new AppError('Workspace not found', 404);
    }

    const isMember = workspace.members.some(m => m.userId === userId);
    if (!isMember) {
      throw new AppError('Access denied', 403);
    }

    return workspace;
  }

  async update(workspaceId: string, userId: string, input: UpdateWorkspaceInput) {
    await this.requireRole(workspaceId, userId, ['OWNER', 'ADMIN']);

    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
      },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    });

    logger.info({ workspaceId, userId }, 'Workspace updated');
    return workspace;
  }

  async delete(workspaceId: string, userId: string) {
    await this.requireRole(workspaceId, userId, ['OWNER']);

    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { deletedAt: new Date() },
    });

    logger.info({ workspaceId, userId }, 'Workspace soft-deleted');
    return workspace;
  }

  async addMember(workspaceId: string, adminUserId: string, email: string, role: AddMemberInput['role']) {
    await this.requireRole(workspaceId, adminUserId, ['OWNER', 'ADMIN']);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError('User not found with that email', 404);
    }

    const existing = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (existing) {
      throw new AppError('User is already a member of this workspace', 409);
    }

    const member = await prisma.workspaceMember.create({
      data: { workspaceId, userId: user.id, role },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });

    logger.info({ workspaceId, userId: user.id, role }, 'Member added to workspace');
    return member;
  }

  async removeMember(workspaceId: string, adminUserId: string, memberId: string) {
    await this.requireRole(workspaceId, adminUserId, ['OWNER', 'ADMIN']);

    const member = await prisma.workspaceMember.findUnique({ where: { id: memberId } });
    if (!member || member.workspaceId !== workspaceId) {
      throw new AppError('Member not found', 404);
    }
    if (member.role === 'OWNER') {
      throw new AppError('Cannot remove the workspace owner', 403);
    }

    await prisma.workspaceMember.delete({ where: { id: memberId } });
    logger.info({ workspaceId, memberId }, 'Member removed from workspace');
  }

  async updateMemberRole(workspaceId: string, adminUserId: string, memberId: string, role: AddMemberInput['role']) {
    await this.requireRole(workspaceId, adminUserId, ['OWNER']);

    const member = await prisma.workspaceMember.findUnique({ where: { id: memberId } });
    if (!member || member.workspaceId !== workspaceId) {
      throw new AppError('Member not found', 404);
    }
    if (member.role === 'OWNER') {
      throw new AppError('Cannot change the workspace owner role', 403);
    }

    const updated = await prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });

    logger.info({ workspaceId, memberId, role }, 'Member role updated');
    return updated;
  }

  async getFolders(workspaceId: string, userId: string) {
    await this.requireMember(workspaceId, userId);

    return prisma.folder.findMany({
      where: { workspaceId },
      include: {
        _count: { select: { prompts: true, children: true } },
        parent: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createFolder(workspaceId: string, userId: string, input: CreateFolderInput) {
    await this.requireRole(workspaceId, userId, ['OWNER', 'ADMIN', 'MEMBER']);

    if (input.parentId) {
      const parent = await prisma.folder.findUnique({ where: { id: input.parentId } });
      if (!parent || parent.workspaceId !== workspaceId) {
        throw new AppError('Parent folder not found', 404);
      }
    }

    const folder = await prisma.folder.create({
      data: {
        name: input.name,
        workspaceId,
        parentId: input.parentId,
      },
    });

    logger.info({ workspaceId, folderId: folder.id }, 'Folder created');
    return folder;
  }

  async getPrompts(workspaceId: string, userId: string) {
    await this.requireMember(workspaceId, userId);

    return prisma.prompt.findMany({
      where: { workspaceId, deletedAt: null },
      include: {
        folder: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      } as any,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createPrompt(workspaceId: string, userId: string, input: CreatePromptInput) {
    await this.requireRole(workspaceId, userId, ['OWNER', 'ADMIN', 'MEMBER']);

    if (input.folderId) {
      const folder = await prisma.folder.findUnique({ where: { id: input.folderId } });
      if (!folder || folder.workspaceId !== workspaceId) {
        throw new AppError('Folder not found in this workspace', 404);
      }
    }

    const prompt = await prisma.prompt.create({
      data: {
        name: input.name,
        content: input.content,
        description: input.description,
        workspaceId,
        folderId: input.folderId,
        userId,
        tags: input.tags || [],
        isPublic: input.isPublic || false,
        isTemplate: input.isTemplate || false,
      },
      include: {
        folder: { select: { id: true, name: true } },
      },
    });

    logger.info({ workspaceId, promptId: prompt.id }, 'Prompt created');
    return prompt;
  }

  async getChats(workspaceId: string, userId: string) {
    await this.requireMember(workspaceId, userId);

    return prisma.chat.findMany({
      where: { workspaceId, deletedAt: null },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async requireRole(workspaceId: string, userId: string, allowedRoles: string[]) {
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    if (!member) {
      throw new AppError('Access denied', 403);
    }
    if (!allowedRoles.includes(member.role)) {
      throw new AppError('Insufficient permissions', 403);
    }
  }

  private async requireMember(workspaceId: string, userId: string) {
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    if (!member) {
      throw new AppError('Access denied', 403);
    }
  }
}

export const workspaceService = new WorkspaceService();
