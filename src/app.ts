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

export interface AppOptions {
  databaseUrl: string;
  logger?: boolean;
  redisUrl: string;
}

export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? true });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandlers(app);

  const prisma = createPrismaClient(options.databaseUrl);

  const messageRepository = new PrismaMessageRepository(prisma);
  const tenantRepository = new PrismaTenantRepository(prisma);
  const messageQueue = new BullMQMessageQueue(options.redisUrl);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    await messageQueue.close();
  });

  app.register(webhookRoutes, {
    prefix: '/webhooks',
    tenantRepository,
    messageRepository,
    messageQueue,
  });
  app.register(messageRoutes, { prefix: '/tenants', messageRepository, tenantRepository });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  return app;
}
