import { RedisContainer } from '@testcontainers/redis';

export interface TestRedis {
  url: string;
  flush(): Promise<void>;
  stop(): Promise<void>;
}

export async function startTestRedis(): Promise<TestRedis> {
  const redisContainer = await new RedisContainer('redis:8-alpine').start();
  return {
    url: redisContainer.getConnectionUrl(),
    flush: async () => {
      await redisContainer.executeCliCmd('flushall');
    },
    stop: async () => {
      await redisContainer.stop();
    },
  };
}
