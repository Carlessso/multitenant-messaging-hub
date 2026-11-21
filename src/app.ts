import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { webhookRoutes } from './modules/webhooks/webhook.routes.js';
import { PrismaMessageRepository } from './modules/messages/message.repository.js';
import { messageRoutes } from './modules/messages/message.routes.js';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { registerErrorHandlers } from './shared/http/error-handler.js';
import { createPrismaClient } from './shared/database/prisma.js';
import { PrismaTenantRepository } from './modules/tenants/tenant.repository.js';
import { BullMQMessageQueue } from './modules/messages/message.queue.js';
import { RedisReplySubscriber } from './modules/replies/redis-reply-subscriber.js';
import { replyRoutes } from './modules/replies/reply.routes.js';
import { tenantRoutes } from './modules/tenants/tenant.routes.js';
import { tenantSettingsRoutes } from './modules/tenants/tenant-settings.routes.js';
import { registerMetrics } from './shared/metrics/metrics.js';

export interface AppOptions {
  databaseUrl: string;
  logger?: boolean;
  redisUrl: string;
  adminApiKey?: string;
}

export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? true, forceCloseConnections: true });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandlers(app);

  const prisma = createPrismaClient(options.databaseUrl);

  const messageRepository = new PrismaMessageRepository(prisma);
  const tenantRepository = new PrismaTenantRepository(prisma);
  const messageQueue = new BullMQMessageQueue(options.redisUrl);
  const replySubscriber = new RedisReplySubscriber(options.redisUrl, (err) => {
    app.log.error({ err }, 'reply subscriber error');
  });

  const metrics = registerMetrics(app, messageQueue);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    await messageQueue.close();
    await replySubscriber.close();
  });

  app.register(webhookRoutes, {
    prefix: '/webhooks',
    tenantRepository,
    messageRepository,
    messageQueue,
  });
  app.register(tenantRoutes, {
    prefix: '/tenants',
    tenantRepository,
    adminApiKey: options.adminApiKey,
  });
  app.register(tenantSettingsRoutes, { prefix: '/tenants', tenantRepository });
  app.register(messageRoutes, { prefix: '/tenants', messageRepository, tenantRepository });
  app.register(replyRoutes, {
    prefix: '/tenants',
    tenantRepository,
    replySubscriber,
    sseConnections: metrics.sseConnections,
  });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  return app;
}
