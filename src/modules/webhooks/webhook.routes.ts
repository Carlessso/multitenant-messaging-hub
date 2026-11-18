import type { FastifyPluginAsync } from 'fastify';
import { webhookMessageSchema } from './webhook.schema.js';

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.post('/:tenantId', async (request, reply) => {
    const parsed = webhookMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.issues };
    }

    reply.code(202);
    return { received: true };
  });
};
