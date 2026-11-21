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
import type { GenerateReplyInput, LLMProvider } from '../llm/llm.provider.js';
import { PrismaTenantRepository } from '../tenants/tenant.repository.js';
import type { ReplyEvent, ReplyPublisher } from '../replies/reply.events.js';

class InMemoryReplyPublisher implements ReplyPublisher {
  readonly events: ReplyEvent[] = [];

  async publish(_tenantId: string, event: ReplyEvent): Promise<void> {
    this.events.push(event);
  }

  async close(): Promise<void> {}
}

class SpyLLMProvider implements LLMProvider {
  readonly inputs: GenerateReplyInput[] = [];

  async *generateReply(input: GenerateReplyInput): AsyncIterable<string> {
    this.inputs.push(input);
    yield 'ok';
  }
}

let db: TestDatabase;
let repo: PrismaMessageRepository;
let tenantRepository: PrismaTenantRepository;
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
  tenantRepository = new PrismaTenantRepository(db.prisma);
}, 60_000);

beforeEach(async () => {
  await resetDatabase(db.prisma);
  replyPublisher = new InMemoryReplyPublisher();
  deps = {
    messageRepository: repo,
    tenantRepository,
    llmProvider: new MockLLMProvider(0),
    replyPublisher,
  };
});

afterAll(async () => {
  await db.stop();
});

describe('process incoming messages', () => {
  it("sends the tenant's name and bot instructions to the LLM", async () => {
    await db.prisma.tenant.create({
      data: { id: tenantId, name: 'Loja X', botInstructions: 'Always be cordial.' },
    });
    await repo.save(inboundMessage);
    const llmProvider = new SpyLLMProvider();

    await processIncomingMessage(job, { ...deps, llmProvider });

    expect(llmProvider.inputs).toHaveLength(1);
    expect(llmProvider.inputs[0]).toMatchObject({
      text: inboundMessage.text,
      tenant: { name: 'Loja X', instructions: 'Always be cordial.' },
    });
  });

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

  it('sends the earlier messages of the same conversation as history', async () => {
    await db.prisma.tenant.create({ data: { id: tenantId, name: 'Loja X' } });
    const earlierQuestion: Message = {
      ...inboundMessage,
      id: crypto.randomUUID(),
      externalId: 'wamid.earlier',
      text: 'Tem pão?',
      receivedAt: new Date('2026-11-18T14:00:00.000Z'),
    };
    await repo.save(earlierQuestion);
    await repo.save({
      ...earlierQuestion,
      id: crypto.randomUUID(),
      externalId: undefined,
      direction: 'outbound',
      text: 'Sai às 6h e às 16h.',
      receivedAt: new Date('2026-11-18T14:00:05.000Z'),
      replyToId: earlierQuestion.id,
    });
    await repo.save({
      ...inboundMessage,
      id: crypto.randomUUID(),
      externalId: 'wamid.other-contact',
      from: { id: '5511888888888' },
      text: 'Other customer',
      receivedAt: new Date('2026-11-18T14:10:00.000Z'),
    });
    await repo.save(inboundMessage);
    const llmProvider = new SpyLLMProvider();

    await processIncomingMessage(job, { ...deps, llmProvider });

    expect(llmProvider.inputs[0]?.history).toEqual([
      { role: 'customer', text: 'Tem pão?' },
      { role: 'assistant', text: 'Sai às 6h e às 16h.' },
    ]);
  });

  it('publishes the pipeline stages with timings', async () => {
    await db.prisma.tenant.create({ data: { id: tenantId, name: 'Loja X' } });
    await repo.save(inboundMessage);

    await processIncomingMessage(job, deps);

    const statuses = replyPublisher.events.flatMap((event) =>
      event.type === 'status' ? [event] : [],
    );
    expect(statuses.map((event) => event.stage)).toEqual(['generating', 'first_token', 'saved']);
    expect(statuses.every((event) => event.externalId === job.externalId)).toBe(true);
    expect(statuses[1]?.detail).toMatchObject({ latencyMs: expect.any(Number) as number });
    expect(statuses[2]?.detail).toMatchObject({ chunks: expect.any(Number) as number });
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
