import type { FastifyPluginAsync } from 'fastify';
import { webhookMessageSchema } from './webhook.schema.js';
import { tenantParamsSchema } from '../../shared/tenant.schema.js';

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.post('/:tenantId', async (request, reply) => {
    const params = tenantParamsSchema.safeParse(request.params);

    if (!params.success) {
      reply.code(400);
      return { error: params.error.issues };
    }

    const body = webhookMessageSchema.safeParse(request.body);
    if (!body.success) {
      reply.code(400);
      return { error: body.error.issues };
    }

    reply.code(202);
    return { received: true };
  });
};
