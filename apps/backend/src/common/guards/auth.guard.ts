import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ 
      error: 'Unauthorized', 
      message: 'Missing or invalid authorization header' 
    });
  }

  const token = authHeader.substring(7);

  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    request.user = payload;
  } catch (err: any) {
    return reply.code(401).send({ 
      error: 'Unauthorized', 
      message: err.message === 'jwt expired' ? 'Token expired' : 'Invalid or expired token' 
    });
  }
}

export function optionalAuth(request: FastifyRequest, _reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
      request.user = payload;
    } catch {
      // Silent fail - user is optional
    }
  }
}

export function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user?.sub) {
    return reply.code(401).send({ 
      error: 'Unauthorized', 
      message: 'Authentication required' 
    });
  }
}

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.code(401).send({ 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
    }
    if (!roles.includes(request.user.role)) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: `Requires one of roles: ${roles.join(', ')}`,
      });
    }
  };
}

export function getUserId(request: FastifyRequest): string {
  return request.user?.sub || 'anonymous';
}
