import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { webhookRoutes } from './modules/webhooks/webhook.routes.js';
import { InMemoryMessageRepository } from './modules/messages/message.repository.js';
import { messageRoutes } from './modules/messages/message.routes.js';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { registerErrorHandlers } from './shared/http/error-handler.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandlers(app);

  const messageRepository = new InMemoryMessageRepository();

  app.register(webhookRoutes, { prefix: '/webhooks', messageRepository });
  app.register(messageRoutes, { prefix: '/tenants', messageRepository });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  return app;
}
