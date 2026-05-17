import type { FastifyInstance } from 'fastify';
import { notificationsController } from '../../presentation/controllers/notifications.controller';
import { authGuard } from '../../common/guards/auth.guard';

export async function registerNotificationsRoutes(app: FastifyInstance) {
  app.get('/api/notifications', {
    preHandler: [authGuard],
    handler: notificationsController.listNotifications,
  });

  app.patch('/api/notifications/:id/read', {
    preHandler: [authGuard],
    handler: notificationsController.markAsRead,
  });

  app.patch('/api/notifications/read-all', {
    preHandler: [authGuard],
    handler: notificationsController.markAllAsRead,
  });

  app.delete('/api/notifications/:id', {
    preHandler: [authGuard],
    handler: notificationsController.deleteNotification,
  });
}
