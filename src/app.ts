import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { webhookRoutes } from './modules/webhooks/webhook.routes.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.register(webhookRoutes, { prefix: '/webhooks' });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  return app;
}
