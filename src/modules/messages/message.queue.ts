import { Queue } from 'bullmq';

export const INCOMING_MESSAGES_QUEUE = 'incoming-messages';

export interface IncomingMessageJob {
  tenantId: string;
  externalId: string;
}

export interface MessageQueue {
  enqueue(job: IncomingMessageJob): Promise<void>;
  close(): Promise<void>;
}

export class BullMQMessageQueue implements MessageQueue {
  private readonly queue: Queue<IncomingMessageJob>;

  constructor(redisUrl: string) {
    this.queue = new Queue(INCOMING_MESSAGES_QUEUE, {
      connection: { url: redisUrl },
    });
  }

  async enqueue(job: IncomingMessageJob): Promise<void> {
    await this.queue.add('process-message', job, {
      jobId: `${job.tenantId}_${encodeURIComponent(job.externalId)}`,
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
