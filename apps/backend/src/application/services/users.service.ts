import { prisma } from '../../database/prisma/client';
import { logger } from '../../shared/logger/logger.service';
import { errorService } from '../../shared/error-handling/error.service';
import { AppError } from '../../shared/error-handling/error.service';
import { randomBytes } from 'crypto';
import type { UpdateProfileInput, CreateApiKeyInput } from '../../modules/users/users.validator';

export class UsersApplicationService {
  async getProfile(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          createdAt: true,
          subscription: {
            select: {
              tier: true,
              status: true,
              aiCredits: true,
              aiCreditsUsed: true,
              currentPeriodEnd: true,
            },
          },
        },
      });
      
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      
      return user;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, userId }, 'Failed to get user profile');
      throw new AppError('Failed to retrieve user profile', 500, 'PROFILE_FETCH_FAILED');
    }
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    try {
      // Prevent updating sensitive fields
      const safeInput = {
        name: input.name,
        email: input.email,
        avatarUrl: input.avatarUrl
      };
      
      // Remove undefined fields
      Object.keys(safeInput).forEach(key => safeInput[key] === undefined && delete safeInput[key]);
      
      const user = await prisma.user.update({
        where: { id: userId },
        data: safeInput,
        select: { 
          id: true, 
          email: true, 
          name: true, 
          avatarUrl: true, 
          role: true 
        },
      });
      
      logger.info({ userId }, 'Profile updated');
      return user;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, userId, input }, 'Failed to update user profile');
      throw new AppError('Failed to update user profile', 500, 'PROFILE_UPDATE_FAILED');
    }
  }

  async deleteAccount(userId: string) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { deletedAt: new Date() },
      });
      
      logger.info({ userId }, 'Account soft-deleted');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to delete user account');
      throw new AppError('Failed to delete account', 500, 'ACCOUNT_DELETE_FAILED');
    }
  }

  async getApiKeys(userId: string) {
    try {
      return await prisma.apiKey.findMany({
        where: { userId, revokedAt: null },
        select: { 
          id: true, 
          name: true, 
          key: true, 
          lastUsed: true, 
          createdAt: true 
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get API keys');
      throw new AppError('Failed to retrieve API keys', 500, 'API_KEYS_FETCH_FAILED');
    }
  }

  async createApiKey(userId: string, input: CreateApiKeyInput) {
    try {
      // Validate input
      if (!input.name || input.name.trim().length === 0) {
        throw new AppError('API key name is required', 400, 'API_KEY_NAME_REQUIRED');
      }
      
      const key = `nk_${randomBytes(32).toString('hex')}`;
      
      const apiKey = await prisma.apiKey.create({
        data: { 
          userId, 
          name: input.name.trim(), 
          key 
        },
        select: { 
          id: true, 
          name: true, 
          key: true, 
          createdAt: true 
        },
      });
      
      logger.info({ userId, keyName: input.name }, 'API key created');
      return apiKey;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, userId, input }, 'Failed to create API key');
      throw new AppError('Failed to create API key', 500, 'API_KEY_CREATE_FAILED');
    }
  }

  async revokeApiKey(userId: string, keyId: string) {
    try {
      const apiKey = await prisma.apiKey.findFirst({
        where: { id: keyId, userId, revokedAt: null },
      });
      
      if (!apiKey) {
        throw new AppError('API key not found', 404, 'API_KEY_NOT_FOUND');
      }
      
      await prisma.apiKey.update({
        where: { id: keyId },
        data: { revokedAt: new Date() },
      });
      
      logger.info({ userId, keyId }, 'API key revoked');
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, userId, keyId }, 'Failed to revoke API key');
      throw new AppError('Failed to revoke API key', 500, 'API_KEY_REVOKE_FAILED');
    }
  }
}

export const usersApplicationService = new UsersApplicationService();
