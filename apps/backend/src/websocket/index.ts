import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { logger } from '../common/logger';
import { connectionManager } from './connection';
import { eventRegistry } from './events';
import { registerTranscriptionHandlers } from './handlers/transcription.handler';
import { registerAiHandlers } from './handlers/ai.handler';
import type { WsEvent, HandlerContext } from './events';

interface JwtWsPayload {
  sub: string;
  email: string;
  role: string;
}

const messageTimestamps = new Map<string, number[]>();
const RATE_LIMIT_MAX = config.rateLimit.max;
const RATE_LIMIT_WINDOW_MS = config.rateLimit.windowMs;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = messageTimestamps.get(userId) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX) {
    return false;
  }

  recent.push(now);
  messageTimestamps.set(userId, recent);
  return true;
}

export function initWebSocket(app: FastifyInstance): void {
  registerTranscriptionHandlers();
  registerAiHandlers();

  app.get('/ws', { websocket: true }, (socket: WebSocket, request: FastifyRequest) => {
    const token = (request.query as Record<string, string>)?.token;
    if (!token) {
      socket.close(4001, 'Missing authentication token');
      return;
    }

    let userId: string;
    try {
      const payload = jwt.verify(token, config.jwt.secret) as JwtWsPayload;
      userId = payload.sub;
    } catch {
      socket.close(4001, 'Invalid or expired token');
      return;
    }

    connectionManager.addConnection(userId, socket);

    socket.on('message', async (data: WebSocket.Data) => {
      if (!checkRateLimit(userId)) {
        socket.send(
          JSON.stringify({
            type: 'error',
            payload: { code: 'RATE_LIMITED', message: 'Too many messages. Slow down.' },
          }),
        );
        return;
      }

      let event: WsEvent;
      try {
        event = JSON.parse(data.toString());
      } catch {
        socket.send(
          JSON.stringify({
            type: 'error',
            payload: { code: 'INVALID_MESSAGE', message: 'Invalid JSON message format' },
          }),
        );
        return;
      }

      const context: HandlerContext = { userId, socket };
      await eventRegistry.emit(event, context);
    });

    socket.on('close', () => {
      connectionManager.removeConnection(userId, socket);
    });

    socket.on('error', (err: Error) => {
      logger.error({ err, userId }, 'WebSocket connection error');
      connectionManager.removeConnection(userId, socket);
    });
  });

  logger.info('WebSocket initialized on /ws');
}
