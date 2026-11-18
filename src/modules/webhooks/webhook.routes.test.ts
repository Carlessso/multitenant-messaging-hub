import { execFileSync } from 'node:child_process';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';

let container: StartedPostgreSqlContainer;
let app: FastifyInstance;

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

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  app = buildApp({ databaseUrl, logger: false });
}, 60_000);

afterAll(async () => {
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
});
