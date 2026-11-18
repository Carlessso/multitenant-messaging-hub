import { execFileSync } from 'node:child_process';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { createPrismaClient } from '../../shared/database/prisma.js';

let container: StartedPostgreSqlContainer;
let app: FastifyInstance;
let prisma: PrismaClient;

const validPayload = {
  externalId: 'wamid.HBgLNTUxMTk5OTk5OTk5FQIAERgSQzRBMjE2',
  channel: 'whatsapp',
  from: { id: '5511999999999', name: 'Maria Silva' },
  text: 'Oi, vocês abrem no sábado?',
  sentAt: '2026-11-18T14:30:00.000Z',
};

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:18-alpine').start();
  const databaseUrl = container.getConnectionUri();
  prisma = createPrismaClient(databaseUrl);

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  app = buildApp({ databaseUrl, logger: false });
}, 60_000);

beforeEach(async () => {
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.tenant.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
  await app.close();
  await container.stop();
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
    await prisma.tenant.create({
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

    const messages = await prisma.message.findMany({ where: { tenantId: 'loja-x' } });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ received: true });
    expect(messages).toHaveLength(1);
    expect(messages[0]?.text).toBe(validPayload.text);
  });

  it('does not duplicate a redelivered message', async () => {
    await prisma.tenant.create({
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

    const count = await prisma.message.count({ where: { tenantId: 'loja-x' } });

    expect(responseOne.statusCode).toBe(202);
    expect(responseTwo.statusCode).toBe(202);
    expect(count).toBe(1);
  });
});
