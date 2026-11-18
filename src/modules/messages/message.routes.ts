import type { FastifyPluginAsync } from 'fastify';
import type { MessageRepository } from './message.repository.js';
import { tenantParamsSchema } from '../../shared/tenant.schema.js';

export type MessageRoutesOptions = {
  messageRepository: MessageRepository;
};

export const messageRoutes: FastifyPluginAsync<MessageRoutesOptions> = async (app, options) => {
  app.get('/:tenantId/messages', async (request, reply) => {
    const params = tenantParamsSchema.safeParse(request.params);

    if (!params.success) {
      reply.code(400);
      return { error: params.error.issues };
    }

    const messages = await options.messageRepository.listByTenant(params.data.tenantId);
    return { data: messages };
  });
};
