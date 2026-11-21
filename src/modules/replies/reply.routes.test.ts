import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { resetDatabase, startTestDatabase, type TestDatabase } from '../../test/database.js';
import { startTestRedis, type TestRedis } from '../../test/redis.js';
import { RedisReplyPublisher } from './redis-reply-publisher.js';

let app: FastifyInstance;
let db: TestDatabase;
let redis: TestRedis;
let publisher: RedisReplyPublisher;
let baseUrl: string;

beforeAll(async () => {
  [db, redis] = await Promise.all([startTestDatabase(), startTestRedis()]);

  app = buildApp({ databaseUrl: db.url, logger: false, redisUrl: redis.url });
  baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
  publisher = new RedisReplyPublisher(redis.url, (err) => {
    throw err;
  });
}, 60_000);

beforeEach(async () => {
  await resetDatabase(db.prisma);
});

afterAll(async () => {
  await publisher.close();
  await app.close();
  await db.stop();
  await redis.stop();
});

async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  marker: string,
): Promise<string> {
  const decoder = new TextDecoder();
  let received = '';

  while (!received.includes(marker)) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    received += decoder.decode(value, { stream: true });
  }

  return received;
}

describe('GET /tenants/:tenantId/replies/stream', () => {
  it('returns 404 for an unknown tenant', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/tenants/tenant-inexistente/replies/stream',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: 'TENANT_NOT_FOUND' } });
  });

  it("streams the tenant's reply events as server-sent events", async () => {
    await db.prisma.tenant.create({ data: { id: 'loja-x', name: 'Loja X' } });

    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/tenants/loja-x/replies/stream`, {
      signal: controller.signal,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');

    const reader = response.body!.getReader();
    await readUntil(reader, ': connected');

    await publisher.publish('loja-x', { type: 'chunk', replyToId: 'msg-1', text: 'Hello' });
    await publisher.publish('padaria-do-joao', { type: 'chunk', replyToId: 'msg-2', text: 'Nope' });
    await publisher.publish('loja-x', { type: 'done', replyToId: 'msg-1', text: 'Hello' });

    const received = await readUntil(reader, 'event: done');
    controller.abort();

    expect(received).toContain(
      'event: chunk\ndata: {"type":"chunk","replyToId":"msg-1","text":"Hello"}\n\n',
    );
    expect(received).toContain(
      'event: done\ndata: {"type":"done","replyToId":"msg-1","text":"Hello"}\n\n',
    );
    expect(received).not.toContain('msg-2');
  });
});
