import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

vi.mock('../../src/database/prisma/client.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    workspace: {
      findFirst: vi.fn(),
    },
    workspaceMember: {
      update: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../../src/common/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}));

vi.mock('../../src/config/env.js', () => ({
  config: {
    jwt: {
      secret: 'test-secret-32-characters-long-for-testing!!',
      refreshSecret: 'test-refresh-secret-32-characters-long-test!',
      expiresIn: '15m',
      refreshExpiresIn: '7d',
    },
  },
}));

import { authService, AppError } from '../../src/modules/auth/auth.service.js';
import prisma from '../../src/database/prisma/client.js';

const mockHexToken = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'USER',
  emailVerified: false,
  passwordHash: 'hashed-password',
  createdAt: new Date('2025-01-01'),
};

const returnedUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'USER',
  createdAt: new Date('2025-01-01'),
};

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(crypto, 'randomBytes').mockReturnValue({ toString: () => mockHexToken } as unknown as Buffer);
    vi.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-password' as never);
    vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    vi.spyOn(jwt, 'sign').mockReturnValue('mock-access-token' as never);
  });

  describe('register', () => {
    it('should register a new user with valid data', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      (prisma.user.create as any).mockResolvedValue(returnedUser);
      (prisma.workspace.findFirst as any).mockResolvedValue({ id: 'workspace-1' });
      (prisma.workspaceMember.update as any).mockResolvedValue({});
      (prisma.session.create as any).mockResolvedValue({});

      const result = await authService.register({
        email: 'test@example.com',
        password: 'Password123',
        name: 'Test User',
      });

      expect(result.user).toEqual(returnedUser);
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken.length).toBeGreaterThan(50); // Real tokens are 64+ chars
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@example.com',
            name: 'Test User',
          }),
        }),
      );
    });

    it('should throw AppError when email is already registered', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      const act = () =>
        authService.register({
          email: 'test@example.com',
          password: 'Password123',
        });

      await expect(act).rejects.toThrow(AppError);
      await expect(act).rejects.toMatchObject({ statusCode: 409, message: 'Email already registered' });
    });

    it('should register without optional name', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      (prisma.user.create as any).mockResolvedValue({ ...returnedUser, name: null });
      (prisma.workspace.findFirst as any).mockResolvedValue({ id: 'workspace-1' });
      (prisma.workspaceMember.update as any).mockResolvedValue({});
      (prisma.session.create as any).mockResolvedValue({});

      const result = await authService.register({
        email: 'test@example.com',
        password: 'Password123',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(prisma.user.create).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.session.create as any).mockResolvedValue({});

      const result = await authService.login({
        email: 'test@example.com',
        password: 'Password123',
      });

      expect(result.user).toMatchObject({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      });
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken.length).toBeGreaterThan(50);
    });

    it('should throw AppError when email does not exist', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const act = () =>
        authService.login({
          email: 'nonexistent@example.com',
          password: 'Password123',
        });

      await expect(act).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid email or password',
      });
    });

    it('should throw AppError when password is wrong', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      const act = () =>
        authService.login({
          email: 'test@example.com',
          password: 'WrongPassword1',
        });

      await expect(act).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid email or password',
      });
    });

    it('should throw AppError when user has no password hash', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ ...mockUser, passwordHash: null });

      const act = () =>
        authService.login({
          email: 'test@example.com',
          password: 'Password123',
        });

      await expect(act).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid email or password',
      });
    });
  });

  describe('refreshTokens', () => {
    it('should rotate refresh token on valid request', async () => {
      vi.spyOn(jwt, 'verify').mockReturnValue({ sub: 'user-1', iat: 123 } as never);
      const validSession = {
        id: 'session-1',
        refreshToken: 'old-token',
        expiresAt: new Date(Date.now() + 86400000),
        user: returnedUser,
      };
      (prisma.session.findUnique as any).mockResolvedValue(validSession);
      (prisma.session.update as any).mockResolvedValue({});

      const result = await authService.refreshTokens('old-token');

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken.length).toBeGreaterThan(50);
      expect(result.user).toEqual(returnedUser);
      expect(prisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({
            refreshToken: expect.any(String),
          }),
        }),
      );
    });

    it('should throw AppError for expired session', async () => {
      vi.spyOn(jwt, 'verify').mockReturnValue({ sub: 'user-1' } as never);
      (prisma.session.findUnique as any).mockResolvedValue({
        id: 'session-1',
        refreshToken: 'expired-token',
        expiresAt: new Date(Date.now() - 86400000),
        user: returnedUser,
      });

      const act = () => authService.refreshTokens('expired-token');

      await expect(act).rejects.toMatchObject({
        statusCode: 401,
        message: 'Session expired',
      });
    });

    it('should throw AppError for invalid JWT', async () => {
      vi.spyOn(jwt, 'verify').mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      const act = () => authService.refreshTokens('bad-token');

      await expect(act).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid refresh token',
      });
    });
  });

  describe('logout', () => {
    it('should delete sessions and blacklist token', async () => {
      (prisma.session.deleteMany as any).mockResolvedValue({ count: 1 });

      await expect(authService.logout('some-token')).resolves.not.toThrow();
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { refreshToken: 'some-token' },
      });
    });
  });

  describe('getSessions', () => {
    it('should return all active sessions for user', async () => {
      const sessions = [
        { id: 's1', deviceInfo: null, ipAddress: '127.0.0.1', lastActiveAt: new Date(), createdAt: new Date() },
        { id: 's2', deviceInfo: { browser: 'Chrome' }, ipAddress: '10.0.0.1', lastActiveAt: new Date(), createdAt: new Date() },
      ];
      (prisma.session.findMany as any).mockResolvedValue(sessions);

      const result = await authService.getSessions('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('s1');
      expect(prisma.session.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: expect.any(Object),
        orderBy: { lastActiveAt: 'desc' },
      });
    });
  });

  describe('revokeSession', () => {
    it('should revoke a session by id', async () => {
      (prisma.session.findFirst as any).mockResolvedValue({
        id: 'session-1',
        refreshToken: 'revoke-token',
      });
      (prisma.session.delete as any).mockResolvedValue({});

      await authService.revokeSession('session-1', 'user-1');

      expect(prisma.session.delete).toHaveBeenCalledWith({ where: { id: 'session-1' } });
    });

    it('should throw AppError when session not found', async () => {
      (prisma.session.findFirst as any).mockResolvedValue(null);

      const act = () => authService.revokeSession('bad-id', 'user-1');

      await expect(act).rejects.toMatchObject({
        statusCode: 404,
        message: 'Session not found',
      });
    });
  });
});
