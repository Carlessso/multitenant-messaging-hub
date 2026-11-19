import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { resetDatabase, startTestDatabase, type TestDatabase } from '../../test/database.js';

let db: TestDatabase;
let app: FastifyInstance;

const validPayload = {
  externalId: 'wamid.HBgLNTUxMTk5OTk5OTk5FQIAERgSQzRBMjE2',
  channel: 'whatsapp',
  from: { id: '5511999999999', name: 'Maria Silva' },
  text: 'Oi, vocês abrem no sábado?',
  sentAt: '2026-11-18T14:30:00.000Z',
};

beforeAll(async () => {
  db = await startTestDatabase();

  app = buildApp({ databaseUrl: db.url, logger: false });
}, 60_000);

beforeEach(async () => {
  await resetDatabase(db.prisma);
});

afterAll(async () => {
  await app.close();
  await db.stop();
});

describe('GET /tenants/:tenantId/messages', () => {
  it('returns 404 for an unknown tenant', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/tenants/tenant-inexistente/messages',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      error: { code: 'TENANT_NOT_FOUND' },
    });
  });

  it('returns an empty list when the tenant has no messages', async () => {
    await db.prisma.tenant.create({
      data: {
        id: 'loja-x',
        name: 'Loja X',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/tenants/loja-x/messages',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: [] });
  });

  it("returns the tenant's messages", async () => {
    await db.prisma.tenant.create({
      data: {
        id: 'loja-x',
        name: 'Loja X',
      },
    });

    const post = await app.inject({
      method: 'POST',
      url: '/webhooks/loja-x',
      payload: validPayload,
    });

    expect(post.statusCode).toBe(202);

    const response = await app.inject({
      method: 'GET',
      url: '/tenants/loja-x/messages',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ data: [{ text: validPayload.text }] });
  });
});
