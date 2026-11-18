import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { webhookRoutes } from './modules/webhooks/webhook.routes.js';
import { PrismaMessageRepository } from './modules/messages/message.repository.js';
import { messageRoutes } from './modules/messages/message.routes.js';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { registerErrorHandlers } from './shared/http/error-handler.js';
import { createPrismaClient } from './shared/database/prisma.js';
import { PrismaTenantRepository } from './modules/tenants/tenant.repository.js';

export interface AppOptions {
  databaseUrl: string;
  logger?: boolean;
}

export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? true });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandlers(app);

  const prisma = createPrismaClient(options.databaseUrl);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  const messageRepository = new PrismaMessageRepository(prisma);
  const tenantRepository = new PrismaTenantRepository(prisma);

  app.register(webhookRoutes, { prefix: '/webhooks', tenantRepository, messageRepository });
  app.register(messageRoutes, { prefix: '/tenants', messageRepository, tenantRepository });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  return app;
}
