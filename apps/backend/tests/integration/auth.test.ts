import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
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

import { authService } from '../../src/modules/auth/auth.service.js';
import { registerAuthRoutes } from '../../src/modules/auth/auth.routes.js';
import { authGuard } from '../../src/common/guards/auth.guard.js';
import prisma from '../../src/database/prisma/client.js';

describe('Auth API Integration', () => {
  const app = Fastify();
  const mockHexToken = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'USER',
    createdAt: new Date('2025-01-01'),
  };

  beforeAll(async () => {
    await app.register(cookie);
    await registerAuthRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(crypto, 'randomBytes').mockReturnValue({ toString: () => mockHexToken } as unknown as Buffer);
    vi.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-password' as never);
    vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    vi.spyOn(jwt, 'sign').mockReturnValue('mock-access-token' as never);
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user and return 201', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      (prisma.user.create as any).mockResolvedValue(mockUser);
      (prisma.workspace.findFirst as any).mockResolvedValue({ id: 'workspace-1' });
      (prisma.workspaceMember.update as any).mockResolvedValue({});
      (prisma.session.create as any).mockResolvedValue({});

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'Password123',
          name: 'Test User',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.user).toMatchObject({ email: 'test@example.com' });
      expect(body.accessToken).toBe('mock-access-token');
      expect(response.cookies[0]).toMatchObject({
        name: 'refreshToken',
        path: '/api/auth',
      });
    });

    it('should return 409 when email already exists', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'existing@example.com',
          password: 'Password123',
        },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login and return tokens', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        ...mockUser,
        passwordHash: 'hashed-password',
        emailVerified: false,
      });
      (prisma.session.create as any).mockResolvedValue({});

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'Password123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.user).toMatchObject({ email: 'test@example.com' });
      expect(body.accessToken).toBe('mock-access-token');
    });

    it('should return 401 with invalid credentials', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'wrong@example.com',
          password: 'WrongPass1',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh tokens with valid cookie', async () => {
      vi.spyOn(jwt, 'verify').mockReturnValue({ sub: 'user-1' } as never);
      (prisma.session.findUnique as any).mockResolvedValue({
        id: 'session-1',
        refreshToken: 'old-token',
        expiresAt: new Date(Date.now() + 86400000),
        user: mockUser,
      });
      (prisma.session.update as any).mockResolvedValue({});

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        cookies: { refreshToken: 'old-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.accessToken).toBe('mock-access-token');
      expect(body.user).toMatchObject({ email: 'test@example.com' });
    });

    it('should return 401 without refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully with valid auth', async () => {
      vi.spyOn(jwt, 'verify').mockReturnValue({ sub: 'user-1', email: 'test@example.com', role: 'USER' } as never);
      (prisma.session.deleteMany as any).mockResolvedValue({ count: 1 });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { authorization: 'Bearer mock-access-token' },
        cookies: { refreshToken: 'some-token' },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toMatchObject({ message: 'Logged out successfully' });
    });

    it('should return 401 without auth header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/auth/sessions', () => {
    it('should return sessions with valid auth', async () => {
      vi.spyOn(jwt, 'verify').mockReturnValue({ sub: 'user-1', email: 'test@example.com', role: 'USER' } as never);
      (prisma.session.findMany as any).mockResolvedValue([
        { id: 's1', deviceInfo: null, ipAddress: '127.0.0.1', lastActiveAt: new Date(), createdAt: new Date() },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/sessions',
        headers: { authorization: 'Bearer mock-access-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe('s1');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user profile', async () => {
      vi.spyOn(jwt, 'verify').mockReturnValue({ sub: 'user-1', email: 'test@example.com', role: 'USER' } as never);
      (prisma.user.findUnique as any).mockResolvedValue({
        ...mockUser,
        avatarUrl: null,
        subscription: {
          tier: 'FREE',
          status: 'ACTIVE',
          aiCredits: 100,
          aiCreditsUsed: 0,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: 'Bearer mock-access-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({ email: 'test@example.com' });
      expect(body.subscription).toMatchObject({ tier: 'FREE' });
    });
  });
});
