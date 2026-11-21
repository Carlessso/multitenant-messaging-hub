import { Redis } from 'ioredis';
import { replyChannel, type ReplyEvent, type ReplyPublisher } from './reply.events.js';

export class RedisReplyPublisher implements ReplyPublisher {
  private readonly redis: Redis;

  constructor(
    redisUrl: string,
    private readonly onError: (err: unknown) => void,
  ) {
    this.redis = new Redis(redisUrl);
    this.redis.on('error', onError);
  }

  async publish(tenantId: string, event: ReplyEvent): Promise<void> {
    try {
      await this.redis.publish(replyChannel(tenantId), JSON.stringify(event));
    } catch (err) {
      this.onError(err);
    }
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}
