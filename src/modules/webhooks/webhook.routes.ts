import { webhookMessageSchema } from './webhook.schema.js';
import { tenantParamsSchema } from '../../shared/tenant.schema.js';
import type { MessageRepository } from '../messages/message.repository.js';
import type { Message } from '../messages/message.types.js';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { TenantRepository } from '../tenants/tenant.repository.js';
import { NotFoundError } from '../../shared/http/errors.js';
import type { MessageQueue } from '../messages/message.queue.js';
import { statusEvent, type ReplyPublisher } from '../replies/reply.events.js';

export type WebhookRoutesOptions = {
  messageRepository: MessageRepository;
  tenantRepository: TenantRepository;
  messageQueue: MessageQueue;
  replyPublisher: ReplyPublisher;
};

export const webhookRoutes: FastifyPluginAsyncZod<WebhookRoutesOptions> = async (app, options) => {
  app.post(
    '/:tenantId',
    { schema: { params: tenantParamsSchema, body: webhookMessageSchema } },
    async (request, reply) => {
      const exists = await options.tenantRepository.exists(request.params.tenantId);
      if (!exists) {
        throw new NotFoundError('TENANT_NOT_FOUND', `Tenant ${request.params.tenantId} not found`);
      }

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

      const { tenantId } = request.params;
      const { externalId } = request.body;

      await options.messageRepository.save(message);
      await options.replyPublisher.publish(
        tenantId,
        statusEvent(externalId, 'received', 'api', { channel: request.body.channel }),
      );

      const jobId = await options.messageQueue.enqueue({ tenantId, externalId });
      await options.replyPublisher.publish(
        tenantId,
        statusEvent(externalId, 'enqueued', 'api', { jobId }),
      );

      reply.code(202);
      return { received: true };
    },
  );
};
