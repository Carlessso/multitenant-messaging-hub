import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { tenantParamsSchema } from '../../shared/tenant.schema.js';
import { NotFoundError } from '../../shared/http/errors.js';
import type { TenantRepository } from '../tenants/tenant.repository.js';
import { requireTenantApiKey } from '../tenants/tenant.auth.js';
import type { ReplySubscriber } from './reply.events.js';

const HEARTBEAT_INTERVAL_MS = 15_000;

export type ReplyRoutesOptions = {
  tenantRepository: TenantRepository;
  replySubscriber: ReplySubscriber;
};

export const replyRoutes: FastifyPluginAsyncZod<ReplyRoutesOptions> = async (app, options) => {
  app.addHook('preHandler', requireTenantApiKey(options.tenantRepository));

  app.get(
    '/:tenantId/replies/stream',
    { schema: { params: tenantParamsSchema } },
    async (request, reply) => {
      const { tenantId } = request.params;

      const exists = await options.tenantRepository.exists(tenantId);
      if (!exists) {
        throw new NotFoundError('TENANT_NOT_FOUND', `Tenant ${tenantId} not found`);
      }

      reply.hijack();
      const response = reply.raw;
      response.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });

      const unsubscribe = await options.replySubscriber.subscribe(tenantId, (event) => {
        response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      });
      response.write(': connected\n\n');

      const heartbeat = setInterval(() => {
        response.write(': ping\n\n');
      }, HEARTBEAT_INTERVAL_MS);

      const cleanup = (): void => {
        clearInterval(heartbeat);
        unsubscribe().catch((err: unknown) => {
          request.log.error({ err }, 'failed to unsubscribe reply stream');
        });
      };

      if (response.destroyed) {
        cleanup();
      } else {
        response.once('close', cleanup);
      }
    },
  );
};
