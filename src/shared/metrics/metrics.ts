import type { FastifyInstance } from 'fastify';
import { collectDefaultMetrics, Gauge, Histogram, Registry } from 'prom-client';
import type { MessageQueue, QueueStats } from '../../modules/messages/message.queue.js';

export interface ConnectionGauge {
  inc(): void;
  dec(): void;
}

export interface Metrics {
  sseConnections: ConnectionGauge;
}

export function registerMetrics(app: FastifyInstance, messageQueue: MessageQueue): Metrics {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });

  const httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });

  const sseConnections = new Gauge({
    name: 'sse_connections',
    help: 'Open Server-Sent Events connections',
    registers: [registry],
  });

  new Gauge({
    name: 'queue_jobs',
    help: 'Jobs in the incoming-messages queue by state, plus the dead-letter queue',
    labelNames: ['state'],
    registers: [registry],
    async collect() {
      const stats = await messageQueue.getStats();
      for (const [state, count] of Object.entries(stats) as [keyof QueueStats, number][]) {
        this.set({ state }, count);
      }
    },
  });

  app.addHook('onResponse', async (request, reply) => {
    httpDuration.observe(
      {
        method: request.method,
        route: request.routeOptions.url ?? 'unmatched',
        status_code: reply.statusCode,
      },
      reply.elapsedTime / 1000,
    );
  });

  app.get('/metrics', async (_request, reply) => {
    reply.type(registry.contentType);
    return registry.metrics();
  });

  return { sseConnections };
}
