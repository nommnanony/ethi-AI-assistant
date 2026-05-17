import { prisma } from '../../database/prisma/client';
import { logger } from '../../shared/logger/logger.service';
import { errorService } from '../../shared/error-handling/error.service';
import { AppError } from '../../shared/error-handling/error.service';
import type { PaginationInput } from '../../modules/notifications/notifications.validator';

export class NotificationsApplicationService {
  async create(
    userId: string,
    title: string,
    body: string,
    type: string,
    data?: Record<string, unknown>
  ) {
    try {
      // Basic validation
      if (!title || title.trim().length === 0) {
        throw new AppError('Notification title is required', 400, 'NOTIFICATION_TITLE_REQUIRED');
      }
      
      if (!body || body.trim().length === 0) {
        throw new AppError('Notification body is required', 400, 'NOTIFICATION_BODY_REQUIRED');
      }
      
      if (!type || type.trim().length === 0) {
        throw new AppError('Notification type is required', 400, 'NOTIFICATION_TYPE_REQUIRED');
      }
      
      const notification = await prisma.notification.create({
        data: { 
          userId, 
          title: title.trim(), 
          body: body.trim(), 
          type: type.trim(),
          data: data as any 
        },
      });
      
      logger.info({ userId, type }, 'Notification created');
      return notification;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, userId, title, body, type }, 'Failed to create notification');
      throw new AppError('Failed to create notification', 500, 'NOTIFICATION_CREATE_FAILED');
    }
  }

  async list(userId: string, pagination: PaginationInput) {
    try {
      const { page, limit } = pagination;
      
      // Validate pagination inputs
      const pageNum = Math.max(1, parseInt(page.toString(), 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit.toString(), 10) || 10)); // Max 100 items per page
      const skip = (pageNum - 1) * limitNum;
      
      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.notification.count({ where: { userId } }),
      ]);
      
      return {
        data: notifications,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, userId, pagination }, 'Failed to list notifications');
      throw new AppError('Failed to retrieve notifications', 500, 'NOTIFICATIONS_FETCH_FAILED');
    }
  }

  async markRead(userId: string, notificationId: string) {
    try {
      // Validate inputs
      if (!notificationId || notificationId.trim().length === 0) {
        throw new AppError('Notification ID is required', 400, 'NOTIFICATION_ID_REQUIRED');
      }
      
      const notification = await prisma.notification.findFirst({
        where: { id: notificationId.trim(), userId },
      });
      
      if (!notification) {
        throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
      }
      
      return await prisma.notification.update({
        where: { id: notificationId.trim() },
        data: { read: true },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, userId, notificationId }, 'Failed to mark notification as read');
      throw new AppError('Failed to mark notification as read', 500, 'NOTIFICATION_MARK_READ_FAILED');
    }
  }

  async markAllRead(userId: string) {
    try {
      await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      });
      
      logger.info({ userId }, 'All notifications marked as read');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to mark all notifications as read');
      throw new AppError('Failed to mark all notifications as read', 500, 'NOTIFICATIONS_MARK_ALL_READ_FAILED');
    }
  }

  async delete(userId: string, notificationId: string) {
    try {
      // Validate input
      if (!notificationId || notificationId.trim().length === 0) {
        throw new AppError('Notification ID is required', 400, 'NOTIFICATION_ID_REQUIRED');
      }
      
      const notification = await prisma.notification.findFirst({
        where: { id: notificationId.trim(), userId },
      });
      
      if (!notification) {
        throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
      }
      
      await prisma.notification.delete({ where: { id: notificationId.trim() } });
      
      logger.info({ userId, notificationId }, 'Notification deleted');
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error({ error, userId, notificationId }, 'Failed to delete notification');
      throw new AppError('Failed to delete notification', 500, 'NOTIFICATION_DELETE_FAILED');
    }
  }
}

export const notificationsApplicationService = new NotificationsApplicationService();
