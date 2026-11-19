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

describe('POST /webhooks/:tenantId', () => {
  it('returns 404 for an unknown tenant', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/tenant-inexistente',
      payload: validPayload,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      error: { code: 'TENANT_NOT_FOUND' },
    });
  });

  it('persists the message and returns 202', async () => {
    await db.prisma.tenant.create({
      data: {
        id: 'loja-x',
        name: 'Loja X',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/loja-x',
      payload: validPayload,
    });

    const messages = await db.prisma.message.findMany({ where: { tenantId: 'loja-x' } });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ received: true });
    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toBe(validPayload.text);
  });

  it('does not duplicate a redelivered message', async () => {
    await db.prisma.tenant.create({
      data: {
        id: 'loja-x',
        name: 'Tenant dup',
      },
    });

    const responseOne = await app.inject({
      method: 'POST',
      url: '/webhooks/loja-x',
      payload: validPayload,
    });

    const responseTwo = await app.inject({
      method: 'POST',
      url: '/webhooks/loja-x',
      payload: validPayload,
    });

    const count = await db.prisma.message.count({ where: { tenantId: 'loja-x' } });

    expect(responseOne.statusCode).toBe(202);
    expect(responseTwo.statusCode).toBe(202);
    expect(count).toBe(1);
  });

  it('returns 400 with details for an invalid payload', async () => {
    await db.prisma.tenant.create({
      data: {
        id: 'loja-x',
        name: 'Loja x',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/loja-x',
      payload: { ...validPayload, channel: 'telegram' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        details: [{ path: 'body.channel' }],
      },
    });
  });
});
