import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { startTestDatabase, type TestDatabase } from '../../test/database.js';
import { startTestRedis, type TestRedis } from '../../test/redis.js';

let db: TestDatabase;
let app: FastifyInstance;
let redis: TestRedis;

beforeAll(async () => {
  [db, redis] = await Promise.all([startTestDatabase(), startTestRedis()]);

  app = buildApp({ databaseUrl: db.url, logger: false, redisUrl: redis.url });
}, 60_000);

afterAll(async () => {
  await app.close();
  await db.stop();
  await redis.stop();
});

describe('GET /metrics', () => {
  it('exposes Node, HTTP and queue metrics in the Prometheus format', async () => {
    await db.prisma.tenant.create({ data: { id: 'loja-x', name: 'Loja X' } });
    await app.inject({
      method: 'POST',
      url: '/webhooks/loja-x',
      payload: {
        externalId: 'wamid.metrics-1',
        channel: 'whatsapp',
        from: { id: '5511999999999' },
        text: 'Oi',
        sentAt: '2026-11-21T10:00:00.000Z',
      },
    });

    const response = await app.inject({ method: 'GET', url: '/metrics' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toContain('nodejs_eventloop_lag_seconds');
    expect(response.body).toMatch(
      /http_request_duration_seconds_count\{method="POST",route="\/webhooks\/:tenantId",status_code="202"\} 1/,
    );
    expect(response.body).toContain('queue_jobs{state="waiting"} 1');
    expect(response.body).toContain('queue_jobs{state="deadLetter"} 0');
    expect(response.body).toContain('sse_connections 0');
  });
});
