import type { FastifyPluginAsync } from 'fastify';
import { webhookMessageSchema } from './webhook.schema.js';
import { tenantParamsSchema } from '../../shared/tenant.schema.js';
import type { MessageRepository } from '../messages/message.repository.js';
import type { Message } from '../messages/message.types.js';

export type WebhookRoutesOptions = {
  messageRepository: MessageRepository;
};

export const webhookRoutes: FastifyPluginAsync<WebhookRoutesOptions> = async (app, options) => {
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

    const message: Message = {
      id: crypto.randomUUID(),
      tenantId: params.data.tenantId,
      externalId: body.data.externalId,
      channel: body.data.channel,
      from: body.data.from,
      text: body.data.text,
      direction: 'inbound',
      sentAt: new Date(body.data.sentAt),
      receivedAt: new Date(),
    };

    await options.messageRepository.save(message);

    reply.code(202);
    return { received: true };
  });
};
