import { Queue } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { resetDatabase, startTestDatabase, type TestDatabase } from '../../test/database.js';
import { startTestRedis, type TestRedis } from '../../test/redis.js';
import { INCOMING_MESSAGES_QUEUE, type IncomingMessageJob } from '../messages/message.queue.js';

let app: FastifyInstance;
let db: TestDatabase;
let redis: TestRedis;
let queue: Queue<IncomingMessageJob>;

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
  queue = new Queue(INCOMING_MESSAGES_QUEUE, { connection: { url: redis.url } });
}, 60_000);

beforeEach(async () => {
  await resetDatabase(db.prisma);
  await redis.flush();
});

afterAll(async () => {
  await app.close();
  await queue.close();
  await db.stop();
  await redis.stop();
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

  it('enqueues the message for processing', async () => {
    await db.prisma.tenant.create({
      data: {
        id: 'loja-x',
        name: 'Loja X',
      },
    });

    await app.inject({
      method: 'POST',
      url: '/webhooks/loja-x',
      payload: validPayload,
    });

    const job = await queue.getJob(`loja-x_${encodeURIComponent(validPayload.externalId)}`);

    expect(job?.data).toEqual({ tenantId: 'loja-x', externalId: validPayload.externalId });
  });

  it('does not enqueue anything for an unknown tenant', async () => {
    await app.inject({
      method: 'POST',
      url: '/webhooks/tenant-inexistente',
      payload: validPayload,
    });

    expect(await queue.count()).toBe(0);
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
