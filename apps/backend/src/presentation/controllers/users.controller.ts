import type { FastifyRequest, FastifyReply } from 'fastify';
import { updateProfileSchema, createApiKeySchema } from '../validators/users.validator';
import { usersApplicationService } from '../../application/services/users.service';
import { errorService } from '../../shared/error-handling/error.service';
import { AppError } from '../../shared/error-handling/error.service';
import { authGuard } from '../../common/guards/auth.guard';

export class UsersController {
  async getProfile(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const profile = await usersApplicationService.getProfile(userId);
      reply.send(profile);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async updateProfile(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const input = updateProfileSchema.parse(request.body);
      const updatedProfile = await usersApplicationService.updateProfile(userId, input);
      reply.send(updatedProfile);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async deleteAccount(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      await usersApplicationService.deleteAccount(userId);
      reply.code(204).send();
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async getApiKeys(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const apiKeys = await usersApplicationService.getApiKeys(userId);
      reply.send(apiKeys);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async createApiKey(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const input = createApiKeySchema.parse(request.body);
      const apiKey = await usersApplicationService.createApiKey(userId, input);
      reply.code(201).send(apiKey);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async revokeApiKey(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const { id } = request.params as { id: string };
      await usersApplicationService.revokeApiKey(userId, id);
      reply.code(204).send();
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }
}

export const usersController = new UsersController();
