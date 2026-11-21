import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { resetDatabase, startTestDatabase, type TestDatabase } from '../../test/database.js';
import { startTestRedis, type TestRedis } from '../../test/redis.js';
import { createTenant } from '../../test/tenants.js';

let db: TestDatabase;
let app: FastifyInstance;
let redis: TestRedis;

const validPayload = {
  externalId: 'wamid.HBgLNTUxMTk5OTk5OTk5FQIAERgSQzRBMjE2',
  channel: 'whatsapp',
  from: { id: '5511999999999', name: 'Maria Silva' },
  text: 'Oi, vocês abrem no sábado?',
  sentAt: '2026-11-18T14:30:00.000Z',
};

beforeAll(async () => {
  [db, redis] = await Promise.all([startTestDatabase(), startTestRedis()]);

  app = buildApp({ databaseUrl: db.url, logger: false, redisUrl: redis.url });
}, 60_000);

beforeEach(async () => {
  await resetDatabase(db.prisma);
  await redis.flush();
});

afterAll(async () => {
  await app.close();
  await db.stop();
  await redis.stop();
});

describe('GET /tenants/:tenantId/messages', () => {
  it('returns 401 without an API key', async () => {
    await createTenant(db.prisma, 'loja-x');

    const response = await app.inject({ method: 'GET', url: '/tenants/loja-x/messages' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('returns 401 for an unknown API key', async () => {
    await createTenant(db.prisma, 'loja-x');

    const response = await app.inject({
      method: 'GET',
      url: '/tenants/loja-x/messages',
      headers: { authorization: 'Bearer hub_not-a-real-key' },
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns 403 when using another tenant's API key", async () => {
    await createTenant(db.prisma, 'loja-x');
    const otherApiKey = await createTenant(db.prisma, 'padaria-do-joao');

    const response = await app.inject({
      method: 'GET',
      url: '/tenants/loja-x/messages',
      headers: { authorization: `Bearer ${otherApiKey}` },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('returns an empty list when the tenant has no messages', async () => {
    const apiKey = await createTenant(db.prisma, 'loja-x');

    const response = await app.inject({
      method: 'GET',
      url: '/tenants/loja-x/messages',
      headers: { authorization: `Bearer ${apiKey}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: [] });
  });

  it("returns the tenant's messages", async () => {
    const apiKey = await createTenant(db.prisma, 'loja-x');

    const post = await app.inject({
      method: 'POST',
      url: '/webhooks/loja-x',
      payload: validPayload,
    });

    expect(post.statusCode).toBe(202);

    const response = await app.inject({
      method: 'GET',
      url: '/tenants/loja-x/messages',
      headers: { authorization: `Bearer ${apiKey}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ data: [{ text: validPayload.text }] });
  });
});
