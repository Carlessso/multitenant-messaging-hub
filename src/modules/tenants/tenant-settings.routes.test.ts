import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { resetDatabase, startTestDatabase, type TestDatabase } from '../../test/database.js';
import { startTestRedis, type TestRedis } from '../../test/redis.js';
import { createTenant } from '../../test/tenants.js';

let db: TestDatabase;
let app: FastifyInstance;
let redis: TestRedis;

beforeAll(async () => {
  [db, redis] = await Promise.all([startTestDatabase(), startTestRedis()]);

  app = buildApp({ databaseUrl: db.url, logger: false, redisUrl: redis.url });
}, 60_000);

beforeEach(async () => {
  await resetDatabase(db.prisma);
});

afterAll(async () => {
  await app.close();
  await db.stop();
  await redis.stop();
});

function updateSettings(apiKey: string, botInstructions: string | null) {
  return app.inject({
    method: 'PUT',
    url: '/tenants/loja-x/settings',
    headers: { authorization: `Bearer ${apiKey}` },
    payload: { botInstructions },
  });
}

describe('GET /tenants/:tenantId/settings', () => {
  it('returns 401 without an API key', async () => {
    await createTenant(db.prisma, 'loja-x');

    const response = await app.inject({ method: 'GET', url: '/tenants/loja-x/settings' });

    expect(response.statusCode).toBe(401);
  });

  it("returns 403 with another tenant's API key", async () => {
    await createTenant(db.prisma, 'loja-x');
    const otherApiKey = await createTenant(db.prisma, 'padaria-do-joao');

    const response = await app.inject({
      method: 'GET',
      url: '/tenants/loja-x/settings',
      headers: { authorization: `Bearer ${otherApiKey}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it("returns the tenant's profile", async () => {
    const apiKey = await createTenant(db.prisma, 'loja-x', 'Loja X');

    const response = await app.inject({
      method: 'GET',
      url: '/tenants/loja-x/settings',
      headers: { authorization: `Bearer ${apiKey}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: 'loja-x', name: 'Loja X', botInstructions: null });
  });
});

describe('PUT /tenants/:tenantId/settings', () => {
  it('saves the bot instructions', async () => {
    const apiKey = await createTenant(db.prisma, 'loja-x', 'Loja X');

    const response = await updateSettings(apiKey, '  You are the bot of Loja X. Be cordial.  ');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      botInstructions: 'You are the bot of Loja X. Be cordial.',
    });
    const stored = await db.prisma.tenant.findUnique({ where: { id: 'loja-x' } });
    expect(stored?.botInstructions).toBe('You are the bot of Loja X. Be cordial.');
  });

  it('clears the instructions with null or an empty string', async () => {
    const apiKey = await createTenant(db.prisma, 'loja-x');
    await updateSettings(apiKey, 'Be cordial.');

    const response = await updateSettings(apiKey, '   ');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ botInstructions: null });
  });

  it('returns 400 when the instructions are too long', async () => {
    const apiKey = await createTenant(db.prisma, 'loja-x');

    const response = await updateSettings(apiKey, 'a'.repeat(2001));

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});
