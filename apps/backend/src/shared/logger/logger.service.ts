import pino, { Logger } from 'pino';
import { config } from '../../config/env';

export class LoggerService {
  private readonly logger: Logger;

  constructor() {
    this.logger = pino({
      level: config.LOG_LEVEL,
      transport: config.isDev
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss.l',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'body.password', 'body.apiKey'],
        censor: '[REDACTED]',
      },
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          ip: req.ip,
          correlationId: req.headers['x-correlation-id'] || 'none',
        }),
        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },
    });
  }

  info(message: string, context: Record<string, unknown> = {}) {
    this.logger.info({ ...context }, message);
  }

  warn(message: string, context: Record<string, unknown> = {}) {
    this.logger.warn({ ...context }, message);
  }

  error(message: string, context: Record<string, unknown> = {}, error?: Error) {
    this.logger.error(
      { 
        ...context, 
        error: error?.message,
        stack: error?.stack
      }, 
      message
    );
  }

  debug(message: string, context: Record<string, unknown> = {}) {
    this.logger.debug({ ...context }, message);
  }

  trace(message: string, context: Record<string, unknown> = {}) {
    this.logger.trace({ ...context }, message);
  }

  fatal(message: string, context: Record<string, unknown> = {}, error?: Error) {
    this.logger.fatal(
      { 
        ...context, 
        error: error?.message,
        stack: error?.stack
      }, 
      message
    );
  }

  getInstance(): Logger {
    return this.logger;
  }
}

export const loggerService = new LoggerService();
export const logger = loggerService.getInstance();
