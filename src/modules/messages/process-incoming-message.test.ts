import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestDatabase, resetDatabase, type TestDatabase } from '../../test/database.js';
import { PrismaMessageRepository } from './message.repository.js';
import {
  processIncomingMessage,
  type ProcessIncomingMessageDeps,
} from './process-incoming-message.js';
import type { Message } from './message.types.js';
import type { IncomingMessageJob } from './message.queue.js';
import { PermanentJobError } from '../../shared/jobs/errors.js';
import { MockLLMProvider } from '../llm/mock-llm.provider.js';
import type { ReplyEvent, ReplyPublisher } from '../replies/reply.events.js';

class InMemoryReplyPublisher implements ReplyPublisher {
  readonly events: ReplyEvent[] = [];

  async publish(_tenantId: string, event: ReplyEvent): Promise<void> {
    this.events.push(event);
  }

  async close(): Promise<void> {}
}

let db: TestDatabase;
let repo: PrismaMessageRepository;
let deps: ProcessIncomingMessageDeps;
let replyPublisher: InMemoryReplyPublisher;

const tenantId = 'loja-x';

const inboundMessage: Message = {
  id: crypto.randomUUID(),
  tenantId,
  externalId: 'wamid.HBgLNTUxMTk5OTk5OTk5FQIAERgSQzRBMjE2',
  channel: 'whatsapp',
  from: { id: '5511999999999', name: 'Maria Silva' },
  text: 'Oi, vocês abrem no sábado?',
  direction: 'inbound',
  sentAt: new Date('2026-11-18T14:30:00.000Z'),
  receivedAt: new Date('2026-11-18T14:30:01.000Z'),
};

const job: IncomingMessageJob = {
  tenantId,
  externalId: 'wamid.HBgLNTUxMTk5OTk5OTk5FQIAERgSQzRBMjE2',
};

beforeAll(async () => {
  db = await startTestDatabase();

  repo = new PrismaMessageRepository(db.prisma);
}, 60_000);

beforeEach(async () => {
  await resetDatabase(db.prisma);
  replyPublisher = new InMemoryReplyPublisher();
  deps = { messageRepository: repo, llmProvider: new MockLLMProvider(0), replyPublisher };
});

afterAll(async () => {
  await db.stop();
});

describe('process incoming messages', () => {
  it('creates an outbound reply linked to the inbound message', async () => {
    await db.prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Loja X',
      },
    });

    await repo.save(inboundMessage);

    await processIncomingMessage(job, deps);

    const replies = await db.prisma.message.findMany({
      where: {
        direction: 'outbound',
        replyToId: inboundMessage.id,
      },
    });

    expect(replies).toHaveLength(1);
    expect(replies[0]?.text).toBe(`Echo: ${inboundMessage.text}`);
  });

  it('publishes each chunk and then a done event with the full text', async () => {
    await db.prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Loja X',
      },
    });

    await repo.save(inboundMessage);

    await processIncomingMessage(job, deps);

    const chunks = replyPublisher.events.filter((event) => event.type === 'chunk');
    const last = replyPublisher.events.at(-1);
    const expectedText = `Echo: ${inboundMessage.text}`;

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((event) => event.text).join('')).toBe(expectedText);
    expect(last).toEqual({ type: 'done', replyToId: inboundMessage.id, text: expectedText });
  });

  it('does not create a second reply when the job runs twice', async () => {
    await db.prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Loja X',
      },
    });

    await repo.save(inboundMessage);

    await processIncomingMessage(job, deps);
    await processIncomingMessage(job, deps);

    const replies = await db.prisma.message.findMany({
      where: {
        direction: 'outbound',
      },
    });

    expect(replies).toHaveLength(1);
  });

  it('throws exception when message does not exists on db', async () => {
    await db.prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Loja X',
      },
    });

    await repo.save(inboundMessage);

    const newJob = { ...job, externalId: 'safdsadfsa' };

    await expect(processIncomingMessage(newJob, deps)).rejects.toThrow(PermanentJobError);
  });

  it('aborts and saves no reply when the LLM exceeds the timeout', async () => {
    await db.prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Loja X',
      },
    });

    await repo.save(inboundMessage);

    const slowDeps = { ...deps, llmProvider: new MockLLMProvider(1_000) };

    await expect(processIncomingMessage(job, slowDeps, AbortSignal.timeout(50))).rejects.toThrow();

    const replies = await db.prisma.message.findMany({ where: { direction: 'outbound' } });

    expect(replies).toHaveLength(0);
  });
});
