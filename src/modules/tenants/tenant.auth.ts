import type { FastifyRequest } from 'fastify';
import { ForbiddenError, UnauthorizedError } from '../../shared/http/errors.js';
import type { TenantParams } from '../../shared/tenant.schema.js';
import { bearerToken, hashApiKey, safeEqual } from './api-key.js';
import type { TenantRepository } from './tenant.repository.js';

export function requireTenantApiKey(tenantRepository: TenantRepository) {
  return async (request: FastifyRequest): Promise<void> => {
    const apiKey = bearerToken(request.headers.authorization);
    if (!apiKey) {
      throw new UnauthorizedError('Missing API key');
    }

    const tenantId = await tenantRepository.findIdByApiKeyHash(hashApiKey(apiKey));
    if (!tenantId) {
      throw new UnauthorizedError('Invalid API key');
    }

    const { tenantId: requestedTenantId } = request.params as TenantParams;
    if (tenantId !== requestedTenantId) {
      throw new ForbiddenError('API key does not grant access to this tenant');
    }
  };
}

export function requireAdminApiKey(adminApiKey: string | undefined) {
  return async (request: FastifyRequest): Promise<void> => {
    const apiKey = bearerToken(request.headers.authorization);
    if (!adminApiKey || !apiKey || !safeEqual(apiKey, adminApiKey)) {
      throw new UnauthorizedError('Invalid admin API key');
    }
  };
}
