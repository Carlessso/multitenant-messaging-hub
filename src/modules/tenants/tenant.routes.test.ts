import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { resetDatabase, startTestDatabase, type TestDatabase } from '../../test/database.js';
import { startTestRedis, type TestRedis } from '../../test/redis.js';

const adminApiKey = 'test-admin-key-0123456789';

let db: TestDatabase;
let app: FastifyInstance;
let redis: TestRedis;

beforeAll(async () => {
  [db, redis] = await Promise.all([startTestDatabase(), startTestRedis()]);

  app = buildApp({ databaseUrl: db.url, logger: false, redisUrl: redis.url, adminApiKey });
}, 60_000);

beforeEach(async () => {
  await resetDatabase(db.prisma);
});

afterAll(async () => {
  await app.close();
  await db.stop();
  await redis.stop();
});

function createTenantRequest(authorization?: string) {
  return app.inject({
    method: 'POST',
    url: '/tenants',
    headers: authorization ? { authorization } : {},
    payload: { id: 'loja-x', name: 'Loja X' },
  });
}

describe('POST /tenants', () => {
  it('returns 401 without the admin API key', async () => {
    const response = await createTenantRequest();

    expect(response.statusCode).toBe(401);
    expect(await db.prisma.tenant.count()).toBe(0);
  });

  it('returns 401 with a wrong admin API key', async () => {
    const response = await createTenantRequest('Bearer wrong-admin-key-000000');

    expect(response.statusCode).toBe(401);
  });

  it('creates the tenant and returns an API key that grants access to it', async () => {
    const response = await createTenantRequest(`Bearer ${adminApiKey}`);

    expect(response.statusCode).toBe(201);
    const body = response.json<{ id: string; name: string; apiKey: string }>();
    expect(body).toMatchObject({ id: 'loja-x', name: 'Loja X' });
    expect(body.apiKey).toMatch(/^hub_/);

    const stored = await db.prisma.tenant.findUnique({ where: { id: 'loja-x' } });
    expect(stored?.apiKeyHash).not.toBe(body.apiKey);

    const messages = await app.inject({
      method: 'GET',
      url: '/tenants/loja-x/messages',
      headers: { authorization: `Bearer ${body.apiKey}` },
    });
    expect(messages.statusCode).toBe(200);
  });

  it('returns 409 when the tenant already exists', async () => {
    await createTenantRequest(`Bearer ${adminApiKey}`);

    const response = await createTenantRequest(`Bearer ${adminApiKey}`);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: 'TENANT_ALREADY_EXISTS' } });
  });
});
