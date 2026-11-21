import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { NotFoundError } from '../../shared/http/errors.js';
import { tenantParamsSchema } from '../../shared/tenant.schema.js';
import { requireTenantApiKey } from './tenant.auth.js';
import type { TenantRepository } from './tenant.repository.js';
import { botInstructionsSchema } from './tenant.schemas.js';

const updateSettingsSchema = z.object({
  botInstructions: botInstructionsSchema,
});

export type TenantSettingsRoutesOptions = {
  tenantRepository: TenantRepository;
};

export const tenantSettingsRoutes: FastifyPluginAsyncZod<TenantSettingsRoutesOptions> = async (
  app,
  options,
) => {
  app.addHook('preHandler', requireTenantApiKey(options.tenantRepository));

  app.get('/:tenantId/settings', { schema: { params: tenantParamsSchema } }, async (request) => {
    const tenant = await options.tenantRepository.findById(request.params.tenantId);
    if (!tenant) {
      throw new NotFoundError('TENANT_NOT_FOUND', `Tenant ${request.params.tenantId} not found`);
    }
    return tenant;
  });

  app.put(
    '/:tenantId/settings',
    { schema: { params: tenantParamsSchema, body: updateSettingsSchema } },
    async (request) => {
      return options.tenantRepository.updateBotInstructions(
        request.params.tenantId,
        request.body.botInstructions,
      );
    },
  );
};
