import { pino } from 'pino';
import { PrismaMessageRepository } from './modules/messages/message.repository.js';
import { createPrismaClient } from './shared/database/prisma.js';
import { env } from './config/env.js';
import {
  INCOMING_MESSAGES_QUEUE,
  type IncomingMessageJob,
} from './modules/messages/message.queue.js';
import { Worker } from 'bullmq';
import { processIncomingMessage } from './modules/messages/process-incoming-message.js';

const logger = pino();

const prisma = createPrismaClient(env.DATABASE_URL);

const messageRepository = new PrismaMessageRepository(prisma);

const worker = new Worker<IncomingMessageJob>(
  INCOMING_MESSAGES_QUEUE,
  async (job) => {
    await processIncomingMessage(job.data, { messageRepository });
  },
  { connection: { url: env.REDIS_URL } },
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'job completed');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'job failed');
});

worker.on('error', (err) => {
  logger.error({ err }, 'worker error');
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, 'shutting down');

  try {
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'error during shutdown');
    process.exit(1);
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void shutdown(signal));
}

logger.info('worker started');
