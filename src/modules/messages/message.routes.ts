import type { MessageRepository } from './message.repository.js';
import { tenantParamsSchema } from '../../shared/tenant.schema.js';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

export type MessageRoutesOptions = {
  messageRepository: MessageRepository;
};

export const messageRoutes: FastifyPluginAsyncZod<MessageRoutesOptions> = async (app, options) => {
  app.get('/:tenantId/messages', { schema: { params: tenantParamsSchema } }, async (request) => {
    const messages = await options.messageRepository.listByTenant(request.params.tenantId);
    return { data: messages };
  });
};
