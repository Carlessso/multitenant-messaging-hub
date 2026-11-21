import { Queue } from 'bullmq';

export const INCOMING_MESSAGES_QUEUE = 'incoming-messages';

export interface IncomingMessageJob {
  tenantId: string;
  externalId: string;
}

export const INCOMING_MESSAGES_DLQ = 'incoming-messages-dlq';

export interface DeadLetterJob extends IncomingMessageJob {
  originalJobId?: string;
  failedReason: string;
  attemptsMade: number;
}

export interface QueueStats {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  deadLetter: number;
}

export interface MessageQueue {
  enqueue(job: IncomingMessageJob): Promise<void>;
  getStats(): Promise<QueueStats>;
  close(): Promise<void>;
}

export class BullMQMessageQueue implements MessageQueue {
  private readonly queue: Queue<IncomingMessageJob>;
  private readonly deadLetterQueue: Queue<DeadLetterJob>;

  constructor(redisUrl: string) {
    this.deadLetterQueue = new Queue(INCOMING_MESSAGES_DLQ, { connection: { url: redisUrl } });
    this.queue = new Queue(INCOMING_MESSAGES_QUEUE, {
      connection: { url: redisUrl },
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: { age: 60 * 60, count: 1_000 },
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      },
    });
  }

  async enqueue(job: IncomingMessageJob): Promise<void> {
    await this.queue.add('process-message', job, {
      jobId: `${job.tenantId}_${encodeURIComponent(job.externalId)}`,
    });
  }

  async getStats(): Promise<QueueStats> {
    const [counts, deadLetter] = await Promise.all([
      this.queue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
      this.deadLetterQueue.count(),
    ]);

    return {
      waiting: counts['waiting'] ?? 0,
      active: counts['active'] ?? 0,
      delayed: counts['delayed'] ?? 0,
      failed: counts['failed'] ?? 0,
      deadLetter,
    };
  }

  async close(): Promise<void> {
    await Promise.all([this.queue.close(), this.deadLetterQueue.close()]);
  }
}
