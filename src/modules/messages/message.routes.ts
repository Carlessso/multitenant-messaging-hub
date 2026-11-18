import type { MessageRepository } from './message.repository.js';
import { tenantParamsSchema } from '../../shared/tenant.schema.js';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { TenantRepository } from '../tenants/tenant.repository.js';
import { NotFoundError } from '../../shared/http/errors.js';

export type MessageRoutesOptions = {
  messageRepository: MessageRepository;
  tenantRepository: TenantRepository;
};

export const messageRoutes: FastifyPluginAsyncZod<MessageRoutesOptions> = async (app, options) => {
  app.get('/:tenantId/messages', { schema: { params: tenantParamsSchema } }, async (request) => {
    const exists = await options.tenantRepository.exists(request.params.tenantId);
    if (!exists) {
      throw new NotFoundError('TENANT_NOT_FOUND', `Tenant ${request.params.tenantId} not found`);
    }
    const messages = await options.messageRepository.listByTenant(request.params.tenantId);
    return { data: messages };
  });
};
