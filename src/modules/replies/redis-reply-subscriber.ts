import { Redis } from 'ioredis';
import {
  replyChannel,
  replyEventSchema,
  type ReplyListener,
  type ReplySubscriber,
} from './reply.events.js';

export class RedisReplySubscriber implements ReplySubscriber {
  private readonly redis: Redis;
  private readonly listeners = new Map<string, Set<ReplyListener>>();

  constructor(
    redisUrl: string,
    private readonly onError: (err: unknown) => void,
  ) {
    this.redis = new Redis(redisUrl);
    this.redis.on('error', onError);
    this.redis.on('message', (channel: string, raw: string) => {
      this.dispatch(channel, raw);
    });
  }

  async subscribe(tenantId: string, listener: ReplyListener): Promise<() => Promise<void>> {
    const channel = replyChannel(tenantId);
    let channelListeners = this.listeners.get(channel);

    if (!channelListeners) {
      channelListeners = new Set();
      this.listeners.set(channel, channelListeners);
      await this.redis.subscribe(channel);
    }

    channelListeners.add(listener);

    return async () => {
      channelListeners.delete(listener);
      if (channelListeners.size === 0 && this.listeners.get(channel) === channelListeners) {
        this.listeners.delete(channel);
        await this.redis.unsubscribe(channel);
      }
    };
  }

  async close(): Promise<void> {
    this.listeners.clear();
    await this.redis.quit();
  }

  private dispatch(channel: string, raw: string): void {
    const channelListeners = this.listeners.get(channel);
    if (!channelListeners) {
      return;
    }

    let event;
    try {
      event = replyEventSchema.parse(JSON.parse(raw));
    } catch (err) {
      this.onError(err);
      return;
    }

    for (const listener of channelListeners) {
      listener(event);
    }
  }
}
