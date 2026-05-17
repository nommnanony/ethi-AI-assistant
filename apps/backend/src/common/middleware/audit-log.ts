import { prisma } from '../../database/prisma/client';

interface AuditEvent {
  userId: string | null | undefined;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logAuditEvent(event: AuditEvent): Promise<void>;
export async function logAuditEvent(
  userId: string | null | undefined,
  action: string,
  entity: string,
  entityId?: string | null,
  metadata?: Record<string, unknown> | null,
  ipAddress?: string | null,
  userAgent?: string | null,
): Promise<void>;

export async function logAuditEvent(
  userIdOrEvent: string | null | undefined | AuditEvent,
  action?: string,
  entity?: string,
  entityId?: string | null,
  metadata?: Record<string, unknown> | null,
  ipAddress?: string | null,
  userAgent?: string | null,
): Promise<void> {
  if (typeof userIdOrEvent === 'object' && userIdOrEvent !== null) {
    const event = userIdOrEvent;
    await prisma.auditLog.create({
      data: {
        userId: event.userId,
        action: event.action,
        entity: event.entity,
        entityId: event.entityId,
        metadata: event.metadata as any,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
      },
    });
    return;
  }

  await prisma.auditLog.create({
    data: {
      userId: userIdOrEvent,
      action: action!,
      entity: entity!,
      entityId: entityId,
      metadata: metadata as any,
      ipAddress: ipAddress,
      userAgent: userAgent,
    },
  });
}
