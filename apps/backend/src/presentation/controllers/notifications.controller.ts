import type { FastifyRequest, FastifyReply } from 'fastify';
import { paginationSchema } from '../validators/notifications.validator';
import { notificationsApplicationService } from '../../application/services/notifications.service';
import { errorService } from '../../shared/error-handling/error.service';
import { AppError } from '../../shared/error-handling/error.service';
import { authGuard } from '../../common/guards/auth.guard';

export class NotificationsController {
  async listNotifications(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const pagination = paginationSchema.parse(request.query);
      const result = await notificationsApplicationService.list(userId, pagination);
      reply.send(result);
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async markAsRead(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const { id } = request.params as { id: string };
      await notificationsApplicationService.markRead(userId, id);
      reply.send({ message: 'Notification marked as read' });
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async markAllAsRead(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      await notificationsApplicationService.markAllRead(userId);
      reply.send({ message: 'All notifications marked as read' });
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }

  async deleteNotification(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = request.user!.sub;
      const { id } = request.params as { id: string };
      await notificationsApplicationService.delete(userId, id);
      reply.code(204).send();
    } catch (error) {
      errorService.registerErrorHandler(request.server as any);
      throw error;
    }
  }
}

export const notificationsController = new NotificationsController();
