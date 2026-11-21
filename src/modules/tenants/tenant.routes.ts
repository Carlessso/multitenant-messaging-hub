import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ConflictError } from '../../shared/http/errors.js';
import { tenantParamsSchema } from '../../shared/tenant.schema.js';
import { generateApiKey, hashApiKey } from './api-key.js';
import { requireAdminApiKey } from './tenant.auth.js';
import type { TenantRepository } from './tenant.repository.js';
import { botInstructionsSchema } from './tenant.schemas.js';

const createTenantSchema = z.object({
  id: tenantParamsSchema.shape.tenantId,
  name: z.string().trim().min(1).max(200),
  botInstructions: botInstructionsSchema.optional(),
});

export type TenantRoutesOptions = {
  tenantRepository: TenantRepository;
  adminApiKey: string | undefined;
};

export const tenantRoutes: FastifyPluginAsyncZod<TenantRoutesOptions> = async (app, options) => {
  app.addHook('preHandler', requireAdminApiKey(options.adminApiKey));

  app.post('/', { schema: { body: createTenantSchema } }, async (request, reply) => {
    const apiKey = generateApiKey();

    const created = await options.tenantRepository.create({
      id: request.body.id,
      name: request.body.name,
      apiKeyHash: hashApiKey(apiKey),
      botInstructions: request.body.botInstructions ?? null,
    });
    if (!created) {
      throw new ConflictError('TENANT_ALREADY_EXISTS', `Tenant ${request.body.id} already exists`);
    }

    reply.code(201);
    return {
      id: request.body.id,
      name: request.body.name,
      botInstructions: request.body.botInstructions ?? null,
      apiKey,
    };
  });
};
