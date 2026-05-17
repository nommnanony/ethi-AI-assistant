import Fastify from 'fastify';
import { config } from './config/env';
import { logger } from './shared/logger/logger.service';
import { registerPlugins } from './config/plugins';
import { registerModules } from './config/modules';
import { initWebSocket } from './websocket/index';
import { initWorkers } from './workers/index';
import { errorService } from './shared/error-handling/error.service';
import { registerRequestIdMiddleware } from './common/middleware/request-id';
import { notFoundHandler, methodNotAllowedHandler } from './common/filters/error.filter';

async function bootstrap() {
  const app = Fastify({
    logger: logger as any,
    bodyLimit: 10 * 1024 * 1024,
    requestTimeout: 30000,
  });

  registerRequestIdMiddleware(app as any);
  await registerPlugins(app as any);
  errorService.registerErrorHandler(app as any);
  notFoundHandler(app as any);
  methodNotAllowedHandler(app as any);
  await registerModules(app as any);
  await initWebSocket(app as any);
  await initWorkers(app as any);

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    logger.info(`Server running on http://${config.HOST}:${config.PORT}`);
  } catch (err) {
    logger.fatal(err, 'Failed to start server');
    process.exit(1);
  }

  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

bootstrap();
