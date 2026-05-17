import type { FastifyRequest, FastifyReply } from 'fastify';
import bcryptjs from 'bcryptjs';
import { authService } from '../../application/services/auth.service';
import { registerSchema, loginSchema, refreshSchema } from './auth.validator';
import { AppError } from '../../shared/error-handling/error.service';

export class AuthController {
  async register(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const input = registerSchema.parse(request.body);
      const hashedPassword = await bcryptjs.hash(input.password, 10);
      const { user, tokens } = await authService.register({
        email: input.email,
        password: hashedPassword,
        name: input.name ?? undefined,
      });
      reply.code(201).send({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    } catch (error) {
      console.error('REGISTER ERROR:', error);
      if (error instanceof AppError) {
        reply.code(error.statusCode).send({ error: error.message, code: error.code });
      } else {
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  }

  async login(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const input = loginSchema.parse(request.body);
      const { user, tokens } = await authService.login(input.email, input.password);
      reply.send({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    } catch (error) {
      if (error instanceof AppError) {
        reply.code(error.statusCode).send({ error: error.message, code: error.code });
      } else {
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  }

  async refreshToken(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const input = refreshSchema.parse(request.body);
      const result = await authService.refreshToken(input.refreshToken);
      reply.send(result);
    } catch (error) {
      if (error instanceof AppError) {
        reply.code(error.statusCode).send({ error: error.message, code: error.code });
      } else {
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  }

  async logout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const refreshToken = request.body.refreshToken as string;
      await authService.logout(refreshToken);
      reply.send({ success: true });
    } catch (error) {
      if (error instanceof AppError) {
        reply.code(error.statusCode).send({ error: error.message, code: error.code });
      } else {
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  }

  async getSessions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const sessions = await authService.getUserSessions(userId);
      reply.send({ sessions });
    } catch (error) {
      if (error instanceof AppError) {
        reply.code(error.statusCode).send({ error: error.message, code: error.code });
      } else {
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  }

  async revokeSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const sessionId = request.params.sessionId;
      await authService.revokeSession(userId, sessionId);
      reply.send({ success: true });
    } catch (error) {
      if (error instanceof AppError) {
        reply.code(error.statusCode).send({ error: error.message, code: error.code });
      } else {
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  }

  async getCurrentUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const user = await authService.getUserById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      const { passwordHash, ...userWithoutPassword } = user;
      reply.send(userWithoutPassword);
    } catch (error) {
      if (error instanceof AppError) {
        reply.code(error.statusCode).send({ error: error.message, code: error.code });
      } else {
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  }
}

export const authController = new AuthController();