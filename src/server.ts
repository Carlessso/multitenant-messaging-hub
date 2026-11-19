import { buildApp, type AppOptions } from './app.js';
import { env } from './config/env.js';

const options: AppOptions = {
  databaseUrl: env.DATABASE_URL,
  logger: true,
  redisUrl: env.REDIS_URL,
};

const app = buildApp(options);

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info({ signal }, 'shutting down');

  try {
    await app.close();
    process.exit(0);
  } catch (err) {
    app.log.error(err, 'error during shutdown');
    process.exit(1);
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void shutdown(signal));
}

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
