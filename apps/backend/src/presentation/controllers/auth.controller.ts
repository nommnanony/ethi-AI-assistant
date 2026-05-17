import type { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../../application/services/auth.service';
import { registerSchema, loginSchema, refreshSchema } from '../validators/auth.validator';
import { errorService } from '../../shared/error-handling/error.service';
import { AppError } from '../../shared/error-handling/error.service';

export class AuthController {
  async register(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const input = registerSchema.parse(request.body);
      const result = await authService.register(input);

      reply.setCookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: 7 * 24 * 60 * 60,
      });

      reply.code(201).send({
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async login(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const input = loginSchema.parse(request.body);
      const result = await authService.login(input);

      reply.setCookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: 7 * 24 * 60 * 60,
      });

      reply.send({
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async refreshToken(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const refreshToken = request.cookies.refreshToken || (request.body as any)?.refreshToken;
      if (!refreshToken) {
        throw new AppError('Refresh token required', 401, 'REFRESH_TOKEN_REQUIRED');
      }

      const result = await authService.refreshToken(refreshToken);

      reply.setCookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: 7 * 24 * 60 * 60,
      });

      reply.send({
        accessToken: result.accessToken,
        user: result.user,
      });
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async logout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const refreshToken = request.cookies.refreshToken;
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
      reply.clearCookie('refreshToken', { path: '/api/auth' });
      reply.send({ message: 'Logged out successfully' });
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async getSessions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const sessions = await authService.getSessions(userId);
      reply.send(sessions);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async revokeSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { sessionId } = request.params as { sessionId: string };
      const userId = request.user!.sub;

      await authService.revokeSession(sessionId, userId);
      reply.code(204).send();
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async getCurrentUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Import prisma here to avoid circular dependencies during migration
      const prismaInstance = await import('../../database/prisma/client').then(mod => mod.prisma);
      
      const user = await prismaInstance.user.findUnique({
        where: { id: request.user!.sub },
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
            },
          },
        },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      reply.send(user);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }
}

export const authController = new AuthController();
