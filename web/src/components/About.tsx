interface Technology {
  name: string;
  role: string;
}

interface TechnologyGroup {
  title: string;
  items: Technology[];
}

const FLOW = [
  'The customer (this UI, playing a WhatsApp-like provider) posts the message to the webhook.',
  'The API validates it with Zod, saves it in PostgreSQL and enqueues a job in Redis (BullMQ), answering 202 right away.',
  'A separate worker process picks the job, loads the store’s bot instructions and calls the LLM with a timeout.',
  'Each piece of text the LLM generates is published to Redis pub/sub; the API forwards it to the browser over Server-Sent Events.',
  'The reply is saved in PostgreSQL. Failures are retried with exponential backoff and, if they keep failing, moved to a dead-letter queue.',
];

const GROUPS: TechnologyGroup[] = [
  {
    title: 'Backend',
    items: [
      {
        name: 'Node.js 26 + TypeScript (strict, ESM)',
        role: 'Runtime and language of the API and the worker. Type-aware lint rules forbid unhandled promises.',
      },
      {
        name: 'Fastify',
        role: 'HTTP server. Plugins are encapsulated, so auth hooks apply only to tenant routes; hooks handle metrics and graceful shutdown; inject() powers the tests.',
      },
      {
        name: 'Zod',
        role: 'Validates every boundary: request bodies and params, environment variables and events read from Redis. Types are inferred from the schemas.',
      },
      {
        name: 'Server-Sent Events',
        role: 'Streams the reply to the browser chunk by chunk over a plain HTTP response that stays open, with heartbeats and cleanup on disconnect.',
      },
      {
        name: 'Gemini (@google/genai)',
        role: 'Generates the replies behind an LLMProvider interface, with the store’s instructions and the last 10 messages of the conversation as context. A deterministic mock replaces it in development and tests. Every call has an AbortSignal timeout.',
      },
    ],
  },
  {
    title: 'Data and messaging',
    items: [
      {
        name: 'PostgreSQL 18',
        role: 'Source of truth for tenants, conversations and messages. Unique constraints make webhook redeliveries and repeated jobs idempotent.',
      },
      {
        name: 'Prisma 7',
        role: 'Schema, migrations and typed queries, used only behind repository interfaces.',
      },
      {
        name: 'Redis 8',
        role: 'Backs the job queue and the pub/sub channel that carries reply chunks and pipeline events from the worker to the API.',
      },
      {
        name: 'BullMQ',
        role: 'Job queue: deterministic job ids, 5 attempts with exponential backoff, permanent errors that skip retries, and a dead-letter queue.',
      },
    ],
  },
  {
    title: 'Security and observability',
    items: [
      {
        name: 'Per-tenant API keys',
        role: 'Bearer keys stored only as SHA-256 hashes; another tenant’s key gets 403. Creating tenants needs an admin key compared in constant time.',
      },
      {
        name: 'Pino',
        role: 'Structured JSON logs with a request id that also appears in every error response.',
      },
      {
        name: 'Prometheus (prom-client)',
        role: 'GET /metrics: event loop lag, HTTP latency per route, queue depth, dead-letter size and open SSE connections.',
      },
    ],
  },
  {
    title: 'Quality and delivery',
    items: [
      {
        name: 'Vitest + Testcontainers',
        role: 'Integration tests against real PostgreSQL and Redis containers, plus unit tests for schemas, prompts and the processor.',
      },
      {
        name: 'Docker Compose + nginx',
        role: 'One command runs everything: database, Redis, migrations, API, worker and this UI, which nginx serves while proxying the API and the SSE stream.',
      },
      {
        name: 'GitHub Actions',
        role: 'On every push: formatting, lint, type checking, the full test suite, the web build and the Docker images.',
      },
      {
        name: 'React 19 + Vite',
        role: 'This UI. It reads the reply stream with fetch and a stream reader, because EventSource cannot send the Authorization header.',
      },
    ],
  },
];

export function About() {
  return (
    <main className="about">
      <section className="card">
        <h2>About this project</h2>
        <p>
          A multi-tenant messaging hub: stores receive customer messages from a (simulated)
          WhatsApp/Instagram webhook and an AI assistant, configured by each store owner, replies in
          real time. It is a backend portfolio project; this UI exists to show the backend at work.
        </p>
        <h3>What happens when a customer sends a message</h3>
        <ol className="flow">
          {FLOW.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="hint">
          Open the <strong>Backend activity</strong> panel in the chat to watch each of these steps
          live, with timings.
        </p>
      </section>

      {GROUPS.map((group) => (
        <section className="card" key={group.title}>
          <h2>{group.title}</h2>
          <dl className="tech">
            {group.items.map((item) => (
              <div key={item.name}>
                <dt>{item.name}</dt>
                <dd>{item.role}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </main>
  );
}
