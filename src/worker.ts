import { pino } from 'pino';
import { PrismaMessageRepository } from './modules/messages/message.repository.js';
import { createPrismaClient } from './shared/database/prisma.js';
import { env } from './config/env.js';
import {
  INCOMING_MESSAGES_DLQ,
  INCOMING_MESSAGES_QUEUE,
  type DeadLetterJob,
  type IncomingMessageJob,
} from './modules/messages/message.queue.js';
import { Queue, UnrecoverableError, Worker, type Job } from 'bullmq';
import { processIncomingMessage } from './modules/messages/process-incoming-message.js';
import { PermanentJobError } from './shared/jobs/errors.js';
import { MockLLMProvider } from './modules/llm/mock-llm.provider.js';
import { GeminiLLMProvider } from './modules/llm/gemini-llm.provider.js';
import type { LLMProvider } from './modules/llm/llm.provider.js';
import { RedisReplyPublisher } from './modules/replies/redis-reply-publisher.js';

const logger = pino();

function createLLMProvider(): LLMProvider {
  if (env.LLM_PROVIDER === 'gemini' && env.GEMINI_API_KEY) {
    return new GeminiLLMProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL);
  }
  return new MockLLMProvider();
}

const prisma = createPrismaClient(env.DATABASE_URL);

const messageRepository = new PrismaMessageRepository(prisma);
const llmProvider = createLLMProvider();
const replyPublisher = new RedisReplyPublisher(env.REDIS_URL, (err) => {
  logger.error({ err }, 'reply publisher error');
});

const deadLetterQueue = new Queue<DeadLetterJob>(INCOMING_MESSAGES_DLQ, {
  connection: { url: env.REDIS_URL },
});

function isFinalFailure(job: Job<IncomingMessageJob>, err: Error): boolean {
  return err instanceof UnrecoverableError || job.attemptsMade >= (job.opts.attempts ?? 1);
}

async function moveToDeadLetter(job: Job<IncomingMessageJob>, err: Error): Promise<void> {
  try {
    await deadLetterQueue.add(
      'dead-letter',
      {
        ...job.data,
        originalJobId: job.id,
        failedReason: err.message,
        attemptsMade: job.attemptsMade,
      },
      { jobId: job.id },
    );
    logger.warn({ jobId: job.id }, 'job moved to dead-letter queue');
  } catch (dlqErr) {
    logger.error({ jobId: job.id, err: dlqErr }, 'failed to move job to dead-letter queue');
  }
}

const worker = new Worker<IncomingMessageJob>(
  INCOMING_MESSAGES_QUEUE,
  async (job) => {
    try {
      await processIncomingMessage(
        job.data,
        { messageRepository, llmProvider, replyPublisher },
        AbortSignal.timeout(env.LLM_TIMEOUT_MS),
      );
    } catch (err) {
      if (err instanceof PermanentJobError) {
        throw new UnrecoverableError(err.message);
      }
      throw err;
    }
  },
  { connection: { url: env.REDIS_URL } },
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'job completed');
});

worker.on('failed', (job, err) => {
  logger.error(
    { jobId: job?.id, attempt: job?.attemptsMade, maxAttempts: job?.opts.attempts, err },
    'job failed',
  );

  if (job && isFinalFailure(job, err)) {
    void moveToDeadLetter(job, err);
  }
});

worker.on('error', (err) => {
  logger.error({ err }, 'worker error');
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, 'shutting down');

  try {
    await worker.close();
    await deadLetterQueue.close();
    await replyPublisher.close();
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

logger.info({ llmProvider: env.LLM_PROVIDER, model: env.GEMINI_MODEL }, 'worker started');
