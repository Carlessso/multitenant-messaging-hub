import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestDatabase, resetDatabase, type TestDatabase } from '../../test/database.js';
import { PrismaMessageRepository } from './message.repository.js';
import { processIncomingMessage } from './process-incoming-message.js';
import type { Message } from './message.types.js';
import type { IncomingMessageJob } from './message.queue.js';
import { PermanentJobError } from '../../shared/jobs/errors.js';

let db: TestDatabase;
let repo: PrismaMessageRepository;

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

    await processIncomingMessage(job, { messageRepository: repo });

    const replies = await db.prisma.message.findMany({
      where: {
        direction: 'outbound',
        replyToId: inboundMessage.id,
      },
    });

    expect(replies).toHaveLength(1);
  });

  it('does not create a second reply when the job runs twice', async () => {
    await db.prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Loja X',
      },
    });

    await repo.save(inboundMessage);

    await processIncomingMessage(job, { messageRepository: repo });
    await processIncomingMessage(job, { messageRepository: repo });

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

    await expect(processIncomingMessage(newJob, { messageRepository: repo })).rejects.toThrow(
      PermanentJobError,
    );
  });
});
