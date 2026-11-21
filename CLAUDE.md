# multitenant-messaging-hub

Multi-tenant messaging hub: receives WhatsApp/Instagram-style webhooks, persists each message, processes it through a queue (retry, idempotency, dead-letter), and auto-replies with an LLM, streaming the reply via SSE. There is no real WhatsApp/Instagram integration: providers are simulated, and a React chat UI plays the customer's side.

## Stack

- Node.js 26 (LTS, see `.nvmrc`), TypeScript (strict), ESM (`"type": "module"`)
- Fastify + Zod (validation at every boundary: HTTP, env, external APIs)
- PostgreSQL + Prisma
- BullMQ + Redis
- LLM: Gemini behind an `LLMProvider` interface (mocked in tests)
- Vitest + Testcontainers
- Docker Compose, GitHub Actions
- Pino (logs), OpenTelemetry/Prometheus (metrics)
- ESLint with type-aware rules (`no-floating-promises`, `no-misused-promises`)

## Commands

- `npm run dev`: run the API with tsx watch + `.env` + pino-pretty
- `npm run dev:worker`: run the queue worker the same way (separate process; run alongside `dev`)
- `npm run typecheck`: `tsc --noEmit` (tsx does NOT type-check)
- `npm run lint`: ESLint
- `npm run format` / `npm run format:check`: Prettier
- `npm run build` / `npm start` / `npm run start:worker`: compile to `dist/` and run the API / worker with plain Node
- `npm test`: Vitest (Docker must be running for Testcontainers)
- `docker compose up -d`: start PostgreSQL (`127.0.0.1:5432`) and Redis (`127.0.0.1:6379`, `noeviction`)
- `npm run db:migrate`: `prisma migrate dev` (create + apply migrations; review the generated SQL before applying)
- `npm run db:generate`: regenerate the Prisma client into `src/generated/prisma` (not committed; run after every schema change)
- `npm run db:seed`: idempotent seed of dev tenants (`loja-x`, `padaria-do-joao`)

## Conventions

- **Everything in the repo is in English**: code, comments, commit messages, README, docs.
- Relative imports use the `.js` extension (NodeNext resolution).
- Use `import type` for type-only imports (`verbatimModuleSyntax`).
- Never leave a Promise unhandled; always `await` it, or mark it explicitly with `void`.
- Never use `console.log`: in the API use `app.log` / `request.log`; in the worker use its Pino `logger`.
- Secrets (e.g. `GEMINI_API_KEY`) only in `.env`, which is gitignored. Keep `.env.example` up to date.
- Commits follow Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`).
- Prisma is pinned to 7.x (the `prisma` npm `latest` tag pointed to an 8.0 RC). Don't run `prisma init`; it overwrites `.env`/`.gitignore`.
- Routes depend on repository interfaces, never on Prisma directly. Implementations are created once in each composition root (`buildApp()` for the API, `worker.ts` for the worker) and injected.
- Handlers signal expected failures by throwing `AppError` subclasses (e.g. `NotFoundError`); the central error handler formats every error response.
- Applied migrations are immutable: fix mistakes with a new migration.
- Job processors (e.g. `processIncomingMessage`) are plain functions with injected deps and know nothing about BullMQ; `worker.ts` adapts them to the queue. A processor throws `PermanentJobError` for failures that retrying cannot fix; the worker translates it to BullMQ's `UnrecoverableError`.
- Jobs carry only identifiers (`tenantId`, `externalId`); the database is the source of truth. Idempotency is guaranteed by unique constraints, not by the queue's `jobId`.
- LLM access goes through `LLMProvider.generateReply({ text, tenantId, signal })`, which returns an `AsyncIterable<string>`. Tests use `MockLLMProvider`; never call Gemini in tests. Every LLM call receives an `AbortSignal` (timeout from `LLM_TIMEOUT_MS`).
- Reply chunks go worker → Redis pub/sub (`replies:<tenantId>`) → API → SSE. Publishing is best effort; SSE routes must clean up their listeners and timers on the response `close` event.

## Structure

```
src/
  app.ts        # buildApp(): builds the Fastify instance (no listen) — used by tests via inject()
  server.ts     # API entrypoint: listen + graceful shutdown
  worker.ts     # worker entrypoint: consumes incoming-messages, retry, dead-letter queue, graceful shutdown
  config/       # env validation (Zod)
  modules/      # one folder per feature (webhooks, messages, tenants, llm, replies): schemas, routes, repositories, queue, processors
  shared/
    database/   # createPrismaClient()
    http/       # error handler + AppError classes
    jobs/       # job error classes (PermanentJobError)
  test/         # Testcontainers helpers (Postgres, Redis)
  generated/    # Prisma client (generated, gitignored)
prisma/
  schema.prisma # tenants, conversations, messages
  migrations/
  seed.ts
```

Standard error response: `{ "error": { "code", "message", "details"?, "requestId" } }` with codes `VALIDATION_ERROR`, `BAD_REQUEST`, `NOT_FOUND`, `TENANT_NOT_FOUND`, `INTERNAL_ERROR`.

## Roadmap

1. Setup: TypeScript, tsx, Fastify, ESLint, folder structure
2. `POST /webhooks/:tenantId` (Zod validation, clear 400), `GET /tenants/:tenantId/messages` (in-memory), standard error format
3. PostgreSQL + Prisma (tenants, conversations, messages) + Docker Compose
4. Tests with Vitest + Testcontainers
5. BullMQ queue: async processing with retry, idempotency and dead-letter
6. `LLMProvider` (Gemini + mock), auto-reply streamed via SSE
7. Per-tenant API key auth, Pino logs, metrics, CI on GitHub Actions
8. React chat UI: create tenants (`POST /tenants`), send messages as a fake customer through the webhook, and watch replies stream in via SSE
