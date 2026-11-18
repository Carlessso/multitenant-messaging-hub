import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { webhookRoutes } from './modules/webhooks/webhook.routes.js';
import { InMemoryMessageRepository } from './modules/messages/message.repository.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  const messageRepository = new InMemoryMessageRepository();
  app.register(webhookRoutes, { prefix: '/webhooks', messageRepository });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  return app;
}
