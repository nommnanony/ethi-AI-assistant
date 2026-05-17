import { prisma } from '../../database/prisma/client';
import { logger } from '../../shared/logger/logger.service';
import { AppError } from '../../shared/error-handling/error.service';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env';
import { redisConnection } from '../../infrastructure/queues/queue';
import crypto from 'crypto';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  sessionId: string;
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
}

export class AuthService {
  private readonly ACCESS_TOKEN_EXPIRES_IN = '15m';
  private readonly REFRESH_TOKEN_EXPIRES_IN = '7d';
  private readonly REFRESH_TOKEN_KEY_PREFIX = 'refresh_token:';
  private readonly SESSION_KEY_PREFIX = 'session:';

  async login(email: string, password: string): Promise<{ user: any; tokens: TokenPair }> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { subscription: true }
    });

    if (!user) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Verify password (in real app, compare hashed password)
    // For now, we'll assume password validation is done elsewhere
    // This is a placeholder - actual implementation would use bcrypt
    const isValidPassword = await this.validatePassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Check if account is locked
    if (await this.isAccountLocked(user.id)) {
      throw new AppError('Account is temporarily locked due to too many failed attempts', 423, 'ACCOUNT_LOCKED');
    }

    // Create session
    const sessionId = this.generateSessionId();
    const sessionData = {
      userId: user.id,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      ipAddress: '', // Would be populated from request in real implementation
      userAgent: '', // Would be populated from request in real implementation
    };

    await this.storeSession(sessionId, sessionData);

    // Generate tokens
    const tokens = await this.generateTokenPair(user, sessionId);

    // Record successful login
    await this.recordLoginAttempt(user.id, true, '');

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        subscription: user.subscription
      },
      tokens
    };
  }

  async refreshToken(refreshToken: string): Promise<{ user: any; tokens: TokenPair }> {
    // Validate refresh token format
    if (!refreshToken || refreshToken.length < 10) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
    }

    // Check if token exists in Redis
    const tokenKey = `${this.REFRESH_TOKEN_KEY_PREFIX}${refreshToken}`;
    const sessionId = await redisConnection.get(tokenKey);

    if (!sessionId) {
      throw new AppError('Invalid or expired refresh token', 401, 'INVALID_TOKEN');
    }

    // Get session data
    const sessionData = await this.getSession(sessionId);
    if (!sessionData) {
      throw new AppError('Session not found', 401, 'SESSION_NOT_FOUND');
    }

    // Verify session belongs to user
    const user = await prisma.user.findUnique({
      where: { id: sessionData.userId },
      include: { subscription: true }
    });

    if (!user) {
      throw new AppError('User not found', 401, 'USER_NOT_FOUND');
    }

    // Rotate refresh token (security best practice)
    await this.revokeRefreshToken(refreshToken);
    
    // Create new session ID for token rotation
    const newSessionId = this.generateSessionId();
    await this.storeSession(newSessionId, {
      ...sessionData,
      lastActivity: new Date().toISOString()
    });

    // Revoke old session
    await this.revokeSession(sessionId);

    // Generate new tokens
    const tokens = await this.generateTokenPair(user, newSessionId);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        subscription: user.subscription
      },
      tokens
    };
  }

  async logout(refreshToken: string): Promise<void> {
    // Validate refresh token
    if (!refreshToken || refreshToken.length < 10) {
      throw new AppError('Invalid refresh token', 400, 'INVALID_TOKEN');
    }

    // Find and revoke refresh token
    const tokenKey = `${this.REFRESH_TOKEN_KEY_PREFIX}${refreshToken}`;
    const sessionId = await redisConnection.get(tokenKey);

    if (sessionId) {
      // Revoke the refresh token
      await this.revokeRefreshToken(refreshToken);
      
      // Revoke the session
      await this.revokeSession(sessionId);
    }
  }

  async validateAccessToken(token: string): Promise<JwtPayload | null> {
    try {
      const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
      
      // Verify session still exists
      const sessionData = await this.getSession(payload.sessionId);
      if (!sessionData) {
        return null;
      }
      
      // Verify user still exists and is active
      const user = await prisma.user.findUnique({
        where: { id: payload.sub }
      });
      
      if (!user) {
        return null;
      }
      
      return payload;
    } catch (error) {
      return null;
    }
  }

  async findUserByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email }
    });
  }

  async createUser(data: { email: string; password: string; name?: string | null }) {
    return await prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.password, // TODO: hash password in real implementation
        name: data.name,
        role: 'USER',
      }
    });
  }

  async getUserSessions(userId: string) {
    // In a real implementation, this would query Redis for all sessions for this user
    // For now, we'll return an empty array
    return [];
  }

  async getUserById(userId: string) {
    return await prisma.user.findUnique({
      where: { id: userId }
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    // Verify the session belongs to the user before revoking
    const sessionData = await this.getSession(sessionId);
    if (sessionData && sessionData.userId === userId) {
      await this.revokeSessionById(sessionId);
    }
  }

  private async revokeSessionById(sessionId: string): Promise<void> {
    await redisConnection.del(`${this.SESSION_KEY_PREFIX}${sessionId}`);
  }

  private async generateTokenPair(user: any, sessionId: string): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900 // 15 minutes
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: this.ACCESS_TOKEN_EXPIRES_IN
    });

    // Generate secure refresh token
    const refreshToken = crypto.randomBytes(32).toString('hex');
    
    // Store refresh token hash in Redis (we store the hash for security)
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await redisConnection.set(
      `${this.REFRESH_TOKEN_KEY_PREFIX}${refreshTokenHash}`,
      sessionId,
      'EX',
      7 * 24 * 60 * 60 // 7 days
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: 900, // 15 minutes
      refreshTokenExpiresIn: 7 * 24 * 60 * 60 // 7 days
    };
  }

  private async validatePassword(password: string, passwordHash: string): Promise<boolean> {
    // In a real implementation, this would use bcrypt or similar
    // For now, we'll do a simple comparison (NOT SECURE - just for example)
    // TODO: Implement proper password hashing with bcrypt
    return password === passwordHash;
  }

  private generateSessionId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private async storeSession(sessionId: string, sessionData: any): Promise<void> {
    await redisConnection.set(
      `${this.SESSION_KEY_PREFIX}${sessionId}`,
      JSON.stringify(sessionData),
      'EX',
      7 * 24 * 60 * 60 // 7 days
    );
  }

  private async getSession(sessionId: string): Promise<any | null> {
    const data = await redisConnection.get(`${this.SESSION_KEY_PREFIX}${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  private async revokeSession(sessionId: string): Promise<void> {
    await redisConnection.del(`${this.SESSION_KEY_PREFIX}${sessionId}`);
  }

  private async revokeRefreshToken(refreshToken: string): Promise<void> {
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await redisConnection.del(`${this.REFRESH_TOKEN_KEY_PREFIX}${refreshTokenHash}`);
  }

  private async isAccountLocked(userId: string): Promise<boolean> {
    // Check if account is locked due to too many failed attempts
    const failedAttemptsKey = `failed_login_attempts:${userId}`;
    const attempts = await redisConnection.get(failedAttemptsKey);
    
    if (!attempts) return false;
    
    const attemptCount = parseInt(attempts, 10);
    return attemptCount >= 5; // Lock after 5 failed attempts
  }

  private async recordLoginAttempt(userId: string, successful: boolean, ipAddress: string): Promise<void> {
    const failedAttemptsKey = `failed_login_attempts:${userId}`;
    
    if (successful) {
      // Reset failed attempts on successful login
      await redisConnection.del(failedAttemptsKey);
    } else {
      // Increment failed attempts
      await redisConnection.incr(failedAttemptsKey);
      await redisConnection.expire(failedAttemptsKey, 900); // Expire after 15 minutes
    }
    
    // Record login attempt for audit purposes
    await prisma.loginAttempt.create({
      data: {
        userId,
        successful,
        ipAddress,
        attemptedAt: new Date()
      }
    });
  }

  async findUserByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email }
    });
  }

  async createUser(data: { email: string; password: string; name?: string | null }) {
    return await prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.password, // TODO: hash password in real implementation
        name: data.name,
        role: 'USER',
      }
    });
  }

  async getUserSessions(userId: string) {
    // In a real implementation, this would query Redis for all sessions for this user
    // For now, we'll return an empty array
    return [];
  }

  async getUserById(userId: string) {
    return await prisma.user.findUnique({
      where: { id: userId }
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    // Verify the session belongs to the user before revoking
    const sessionData = await this.getSession(sessionId);
    if (sessionData && sessionData.userId === userId) {
      await this.revokeSessionById(sessionId);
    }
  }

  async register(data: { email: string; password: string; name?: string | null }) {
    // Check if user already exists
    const existingUser = await this.findUserByEmail(data.email);
    if (existingUser) {
      throw new AppError('User already exists', 409, 'USER_ALREADY_EXISTS');
    }

    // Create user
    const user = await this.createUser({
      email: data.email,
      password: data.password,
      name: data.name,
    });

    // Generate tokens for the new user
    const tokens = await this.generateTokenPair(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      tokens,
    };
  }

  private async revokeSessionById(sessionId: string): Promise<void> {
    await redisConnection.del(`${this.SESSION_KEY_PREFIX}${sessionId}`);
  }
}

export const authService = new AuthService();
