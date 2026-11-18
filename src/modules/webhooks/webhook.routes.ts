import { webhookMessageSchema } from './webhook.schema.js';
import { tenantParamsSchema } from '../../shared/tenant.schema.js';
import type { MessageRepository } from '../messages/message.repository.js';
import type { Message } from '../messages/message.types.js';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

export type WebhookRoutesOptions = {
  messageRepository: MessageRepository;
};

export const webhookRoutes: FastifyPluginAsyncZod<WebhookRoutesOptions> = async (app, options) => {
  app.post(
    '/:tenantId',
    { schema: { params: tenantParamsSchema, body: webhookMessageSchema } },
    async (request, reply) => {
      const message: Message = {
        id: crypto.randomUUID(),
        tenantId: request.params.tenantId,
        externalId: request.body.externalId,
        channel: request.body.channel,
        from: request.body.from,
        text: request.body.text,
        direction: 'inbound',
        sentAt: new Date(request.body.sentAt),
        receivedAt: new Date(),
      };

      await options.messageRepository.save(message);

      reply.code(202);
      return { received: true };
    },
  );
};
