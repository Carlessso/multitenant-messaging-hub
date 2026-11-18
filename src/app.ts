import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { webhookRoutes } from './modules/webhooks/webhook.routes.js';
import { InMemoryMessageRepository } from './modules/messages/message.repository.js';
import { messageRoutes } from './modules/messages/message.routes.js';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { registerErrorHandlers } from './shared/http/error-handler.js';
import { createPrismaClient } from './shared/database/prisma.js';
import { env } from './config/env.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandlers(app);

  const prisma = createPrismaClient(env.DATABASE_URL);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  const messageRepository = new InMemoryMessageRepository();

  app.register(webhookRoutes, { prefix: '/webhooks', messageRepository });
  app.register(messageRoutes, { prefix: '/tenants', messageRepository });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  return app;
}
