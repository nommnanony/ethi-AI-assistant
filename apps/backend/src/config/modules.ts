import type { FastifyInstance } from 'fastify';
import { authModule } from '../modules/auth/auth.module';
import { usersModule } from '../modules/users/users.module';
import { subscriptionsModule } from '../modules/subscriptions/subscriptions.module';
import { paymentsModule } from '../modules/payments/payments.module';
import { aiModule } from '../modules/ai/ai.module';
import { transcriptionModule } from '../modules/transcription/transcription.module';
import { workspaceModule } from '../modules/workspace/workspace.module';
import { analyticsModule } from '../modules/analytics/analytics.module';
import { webhooksModule } from '../modules/webhooks/webhooks.module';
import { notificationsModule } from '../modules/notifications/notifications.module';
import { ragModule } from '../modules/rag/rag.module';

interface Module {
  register: (app: FastifyInstance) => Promise<void>;
}

const modules: Module[] = [
  authModule,
  usersModule,
  subscriptionsModule,
  paymentsModule,
  aiModule,
  transcriptionModule,
  workspaceModule,
  analyticsModule,
  webhooksModule,
  notificationsModule,
  ragModule,
];

export async function registerModules(app: FastifyInstance) {
  for (const module of modules) {
    await module.register(app);
  }
}
