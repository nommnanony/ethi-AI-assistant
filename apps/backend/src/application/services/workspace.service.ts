import { prisma } from '../../database/prisma/client';
import { logger } from '../../shared/logger/logger.service';
import { errorService } from '../../shared/error-handling/error.service';
import { AppError } from '../../shared/error-handling/error.service';
import { randomBytes } from 'crypto';
import type { 
  ZCreateWorkspace, 
  ZUpdateWorkspace, 
  ZCreateFolder, 
  ZCreatePrompt, 
  ZAddMember 
} from '../../modules/workspace/workspace.validator';

export class WorkspaceApplicationService {
  async create(userId: string, input: ZCreateWorkspace) {
    try {
      logger.info({ userId, workspaceName: input.name }, 'Creating workspace');
      
      const workspace = await prisma.workspace.create({
        data: {
          name: input.name,
          slug: `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${randomBytes(4).toString('hex')}`,
          isPersonal: false,
          ownerId: userId,
          members: {
            create: {
              userId: userId,
              role: 'OWNER',
            },
          },
        },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          members: {
            select: {
              userId: true,
              role: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
      });
      
      return workspace;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, userId, input }, 'Failed to create workspace');
      throw new AppError('Failed to create workspace', 500, 'WORKSPACE_CREATE_FAILED');
    }
  }

  async list(userId: string) {
    try {
      return await prisma.workspace.findMany({
        where: {
          members: {
            some: {
              userId: userId,
            },
          },
          deletedAt: null,
        },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          members: {
            select: {
              userId: true,
              role: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });
    } catch (error) {
      logger.error({ error, userId }, 'Failed to list workspaces');
      throw new AppError('Failed to retrieve workspaces', 500, 'WORKSPACES_FETCH_FAILED');
    }
  }

  async getById(workspaceId: string, userId: string) {
    try {
      const workspace = await prisma.workspace.findFirst({
        where: {
          id: workspaceId,
          members: {
            some: {
              userId: userId,
            },
          },
          deletedAt: null,
        },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          members: {
            select: {
              userId: true,
              role: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
      });
      
      if (!workspace) {
        throw new AppError('Workspace not found or access denied', 404, 'WORKSPACE_NOT_FOUND');
      }
      
      return workspace;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, workspaceId, userId }, 'Failed to get workspace');
      throw new AppError('Failed to retrieve workspace', 500, 'WORKSPACE_FETCH_FAILED');
    }
  }

  async update(workspaceId: string, userId: string, input: ZUpdateWorkspace) {
    try {
      // Check if user has permission to update this workspace
      const workspace = await this.getById(workspaceId, userId);
      
      // Only owners and admins can update workspace details
      const member = workspace.members.find(m => m.userId === userId);
      if (!member || !(member.role === 'OWNER' || member.role === 'ADMIN')) {
        throw new AppError('Insufficient permissions to update workspace', 403, 'INSUFFICIENT_PERMISSIONS');
      }
      
      const updatedWorkspace = await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          name: input.name,
          // Slug would typically be updated based on name, but we'll keep it simple for now
        },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          members: {
            select: {
              userId: true,
              role: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
      });
      
      logger.info({ workspaceId, userId }, 'Workspace updated');
      return updatedWorkspace;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, workspaceId, userId, input }, 'Failed to update workspace');
      throw new AppError('Failed to update workspace', 500, 'WORKSPACE_UPDATE_FAILED');
    }
  }

  async delete(workspaceId: string, userId: string) {
    try {
      // Check if user has permission to delete this workspace (only owner)
      const workspace = await this.getById(workspaceId, userId);
      
      const member = workspace.members.find(m => m.userId === userId);
      if (!member || member.role !== 'OWNER') {
        throw new AppError('Only workspace owner can delete workspace', 403, 'INSUFFICIENT_PERMISSIONS');
      }
      
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { deletedAt: new Date() },
      });
      
      logger.info({ workspaceId, userId }, 'Workspace deleted');
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, workspaceId, userId }, 'Failed to delete workspace');
      throw new AppError('Failed to delete workspace', 500, 'WORKSPACE_DELETE_FAILED');
    }
  }

  async addMember(workspaceId: string, userId: string, email: string, role: string) {
    try {
      // Check if user has permission to add members (owner or admin)
      const workspace = await this.getById(workspaceId, userId);
      
      const member = workspace.members.find(m => m.userId === userId);
      if (!member || !(member.role === 'OWNER' || member.role === 'ADMIN')) {
        throw new AppError('Insufficient permissions to add members', 403, 'INSUFFICIENT_PERMISSIONS');
      }
      
      // Find user by email
      const userToAdd = await prisma.user.findUnique({
        where: { email },
      });
      
      if (!userToAdd) {
        throw new AppError('User not found with this email', 404, 'USER_NOT_FOUND');
      }
      
      // Check if user is already a member
      const existingMember = workspace.members.find(m => m.userId === userToAdd.id);
      if (existingMember) {
        throw new AppError('User is already a member of this workspace', 400, 'USER_ALREADY_MEMBER');
      }
      
      // Add member
      const newMember = await prisma.workspaceMember.create({
        data: {
          workspaceId: workspaceId,
          userId: userToAdd.id,
          role: role as any, // Assuming role validation happens elsewhere
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });
      
      logger.info({ workspaceId, userId, addedUserId: userToAdd.id }, 'Member added to workspace');
      return newMember;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, workspaceId, userId, email, role }, 'Failed to add member to workspace');
      throw new AppError('Failed to add member to workspace', 500, 'WORKSPACE_MEMBER_ADD_FAILED');
    }
  }

  async removeMember(workspaceId: string, userId: string, memberId: string) {
    try {
      // Check if user has permission to remove members (owner or admin)
      const workspace = await this.getById(workspaceId, userId);
      
      const member = workspace.members.find(m => m.userId === userId);
      if (!member || !(member.role === 'OWNER' || member.role === 'ADMIN')) {
        throw new AppError('Insufficient permissions to remove members', 403, 'INSUFFICIENT_PERMISSIONS');
      }
      
      // Check if trying to remove owner (need to prevent this or handle ownership transfer)
      const memberToRemove = workspace.members.find(m => m.id === memberId);
      if (!memberToRemove) {
        throw new AppError('Member not found in workspace', 404, 'WORKSPACE_MEMBER_NOT_FOUND');
      }
      
      if (memberToRemove.userId === workspace.ownerId) {
        throw new AppError('Cannot remove workspace owner. Transfer ownership first.', 400, 'CANNOT_REMOVE_OWNER');
      }
      
      // Remove member
      await prisma.workspaceMember.delete({
        where: { id: memberId },
      });
      
      logger.info({ workspaceId, userId, removedMemberId: memberId }, 'Member removed from workspace');
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, workspaceId, userId, memberId }, 'Failed to remove member from workspace');
      throw new AppError('Failed to remove member from workspace', 500, 'WORKSPACE_MEMBER_REMOVE_FAILED');
    }
  }

  async updateMemberRole(workspaceId: string, userId: string, memberId: string, role: string) {
    try {
      // Check if user has permission to update member roles (owner only)
      const workspace = await this.getById(workspaceId, userId);
      
      const member = workspace.members.find(m => m.userId === userId);
      if (!member || member.role !== 'OWNER') {
        throw new AppError('Only workspace owner can update member roles', 403, 'INSUFFICIENT_PERMISSIONS');
      }
      
      // Check if trying to update owner's role (shouldn't be allowed)
      const memberToUpdate = workspace.members.find(m => m.id === memberId);
      if (!memberToUpdate) {
        throw new AppError('Member not found in workspace', 404, 'WORKSPACE_MEMBER_NOT_FOUND');
      }
      
      if (memberToUpdate.userId === workspace.ownerId) {
        throw new AppError('Cannot update workspace owner role', 400, 'CANNOT_UPDATE_OWNER_ROLE');
      }
      
      // Update member role
      const updatedMember = await prisma.workspaceMember.update({
        where: { id: memberId },
        data: { role: role as any },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });
      
      logger.info({ workspaceId, userId, memberId, newRole: role }, 'Member role updated');
      return updatedMember;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, workspaceId, userId, memberId, role }, 'Failed to update member role');
      throw new AppError('Failed to update member role', 500, 'WORKSPACE_MEMBER_ROLE_UPDATE_FAILED');
    }
  }

  async getFolders(workspaceId: string, userId: string) {
    try {
      // Verify user has access to workspace
      await this.getById(workspaceId, userId);
      
      return await prisma.folder.findMany({
        where: {
          workspaceId: workspaceId,
          deletedAt: null,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, workspaceId, userId }, 'Failed to get folders');
      throw new AppError('Failed to retrieve folders', 500, 'FOLDERS_FETCH_FAILED');
    }
  }

  async createFolder(workspaceId: string, userId: string, input: ZCreateFolder) {
    try {
      // Verify user has access to workspace
      const workspace = await this.getById(workspaceId, userId);
      
      // Check if user has permission to create folders (any member can create)
      const member = workspace.members.find(m => m.userId === userId);
       if (!member) {
         throw new AppError('Access denied to workspace', 403, 'ACCESS_DENIED');
       }
      
      const folder = await prisma.folder.create({
        data: {
          name: input.name,
          workspaceId: workspaceId,
          createdById: userId,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });
      
      logger.info({ workspaceId, userId, folderName: input.name }, 'Folder created');
      return folder;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, workspaceId, userId, input }, 'Failed to create folder');
      throw new AppError('Failed to create folder', 500, 'FOLDER_CREATE_FAILED');
    }
  }

  async getPrompts(workspaceId: string, userId: string) {
    try {
      // Verify user has access to workspace
      await this.getById(workspaceId, userId);
      
      return await prisma.prompt.findMany({
        where: {
          workspaceId: workspaceId,
          deletedAt: null,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          folder: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, workspaceId, userId }, 'Failed to get prompts');
      throw new AppError('Failed to retrieve prompts', 500, 'PROMPTS_FETCH_FAILED');
    }
  }

  async createPrompt(workspaceId: string, userId: string, input: ZCreatePrompt) {
    try {
      // Verify user has access to workspace
      const workspace = await this.getById(workspaceId, userId);
      
      // Check if user has permission to create prompts (any member can create)
      const member = workspace.members.find(m => m.userId === userId);
      if (!member) {
        throw new AppError('Access denied to workspace', 403, 'ACCESS_DENIED');
      }
      
      // Validate folder if provided
      let folderId = input.folderId;
      if (folderId) {
        const folder = await prisma.folder.findFirst({
          where: {
            id: folderId,
            workspaceId: workspaceId,
            deletedAt: null,
          },
        });
        
        if (!folder) {
          throw new AppError('Folder not found in workspace', 404, 'FOLDER_NOT_FOUND');
        }
      }
      
      const prompt = await prisma.prompt.create({
        data: {
          title: input.title,
          content: input.content,
          workspaceId: workspaceId,
          folderId: folderId,
          createdById: userId,
          isPublic: input.isPublic ?? false,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          folder: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      
      logger.info({ workspaceId, userId, promptTitle: input.title }, 'Prompt created');
      return prompt;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, workspaceId, userId, input }, 'Failed to create prompt');
      throw new AppError('Failed to create prompt', 500, 'PROMPT_CREATE_FAILED');
    }
  }

  async getChats(workspaceId: string, userId: string) {
    try {
      // Verify user has access to workspace
      await this.getById(workspaceId, userId);
      
      return await prisma.chat.findMany({
        where: {
          workspaceId: workspaceId,
          deletedAt: null,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          workspace: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, workspaceId, userId }, 'Failed to get chats');
      throw new AppError('Failed to retrieve chats', 500, 'CHATS_FETCH_FAILED');
    }
  }
}

export const workspaceApplicationService = new WorkspaceApplicationService();
