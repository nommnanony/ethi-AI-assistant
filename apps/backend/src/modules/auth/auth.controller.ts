import type { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../../application/services/auth.service';
import { registerSchema, loginSchema, refreshSchema } from './auth.validator';
import { errorService } from '../../shared/error-handling/error.service';
import { AppError } from '../../shared-error-handling/error.service';

export class AuthController {
  async register(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const input = registerSchema.parse(request.body);
      // Check if user already exists
      const existingUser = await authService.findUserByEmail(input.email);
      if (existingUser) {
        throw new AppError('User already exists', 409, 'USER_ALREADY_EXISTS');
      }
      
      // Hash password (placeholder - would use bcrypt in real implementation)
      const hashedPassword = input.password; // TODO: hash password
      
      // Create user
      const user = await authService.createUser({
        email: input.email,
        password: hashedPassword,
        name: input.name ?? undefined,
      });
      
      // Generate tokens
      const tokens = await authService.generateTokenPair(user.id);
      
      reply.code(201).send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        tokens,
      });
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async login(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const input = loginSchema.parse(request.body);
      const result = await authService.login(input.email, input.password);
      reply.send(result);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async refreshToken(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const input = refreshSchema.parse(request.body);
      const result = await authService.refreshToken(input.refreshToken);
      reply.send(result);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async logout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const refreshToken = request.body.refreshToken as string;
      await authService.logout(refreshToken);
      reply.send({ success: true });
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async getSessions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const sessions = await authService.getUserSessions(userId);
      reply.send({ sessions });
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async revokeSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const sessionId = request.params.sessionId;
      await authService.revokeSession(userId, sessionId);
      reply.send({ success: true });
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async getCurrentUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const user = await authService.getUserById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      // Remove sensitive data
      const { passwordHash, ...userWithoutPassword } = user;
      reply.send(userWithoutPassword);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }
}

export const authController = new AuthController();