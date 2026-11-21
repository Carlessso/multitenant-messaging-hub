# multitenant-messaging-hub

Multi-tenant messaging hub: receives WhatsApp/Instagram-style webhooks, persists each message, processes it through a queue (retry, idempotency, dead-letter), and auto-replies with an LLM, streaming the reply via SSE. There is no real WhatsApp/Instagram integration: providers are simulated, and a React chat UI plays the customer's side.

## Stack

- Node.js 26 (LTS, see `.nvmrc`), TypeScript (strict), ESM (`"type": "module"`)
- Fastify + Zod (validation at every boundary: HTTP, env, external APIs)
- PostgreSQL + Prisma
- BullMQ + Redis
- LLM: Gemini behind an `LLMProvider` interface (mocked in tests)
- Vitest + Testcontainers
- Docker Compose, GitHub Actions (CI: format, lint, typecheck, tests)
- Pino (logs), Prometheus via `prom-client` (`GET /metrics`)
- ESLint with type-aware rules (`no-floating-promises`, `no-misused-promises`)

## Commands

- `npm run dev`: run the API with tsx watch + `.env` + pino-pretty
- `npm run dev:worker`: run the queue worker the same way (separate process; run alongside `dev`)
- `cd web && npm run dev`: React UI on `127.0.0.1:5173` (Vite proxies `/tenants` and `/webhooks` to the API); `npm run lint` (oxlint) and `npm run build` inside `web/`
- `npm run typecheck`: `tsc --noEmit` (tsx does NOT type-check)
- `npm run lint`: ESLint
- `npm run format` / `npm run format:check`: Prettier
- `npm run build` / `npm start` / `npm run start:worker`: compile to `dist/` and run the API / worker with plain Node
- `npm test`: Vitest (Docker must be running for Testcontainers)
- `bin/setup` / `bin/restart` / `bin/stop [--wipe]`: wrappers to start (creates `.env` if missing, waits for health checks), rebuild + recreate, and stop the Docker stack
- `docker compose up --build`: full stack in containers (postgres, redis, one-shot `migrate` + seed, api on `127.0.0.1:3000`, worker, web/nginx on `127.0.0.1:8080`)
- `docker compose stop` / `start` / `down` (`down -v` wipes data) / `logs -f <service>`: manage the stack
- `docker compose up -d postgres redis`: only the infrastructure, for local development with `npm run dev` (the full stack also binds port 3000)
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
- Tenant routes are protected by `requireTenantApiKey` (a `preHandler` hook added inside each tenant-scoped plugin); `POST /tenants` by `requireAdminApiKey` (`ADMIN_API_KEY`). Only SHA-256 hashes of API keys are stored. The webhook is intentionally unauthenticated (simulated provider). Seeded dev keys: `hub_dev_<tenantId>`.
- The processor sends conversation history to the LLM: the last `HISTORY_LIMIT` (10) messages of the same conversation before the current one (`listConversationBefore`), mapped to `user`/`model` turns by `toGeminiContents`.
- Bot instructions (`tenants.bot_instructions`, max 2000 chars) are loaded per job and placed before fixed guardrails in the Gemini system prompt (`buildSystemInstruction`).
- Metric labels use route templates (`request.routeOptions.url`), never raw URLs or ids.
- Pipeline `status` events (`statusEvent()` in `reply.events.ts`) share the replies channel: the webhook route publishes `received`/`enqueued`, the processor `generating`/`first_token`/`saved`, `worker.ts` `processing`/`failed`/`dead_lettered`. The web UI shows them in the Backend activity panel.
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
    metrics/    # Prometheus registry, HTTP/queue/SSE metrics, GET /metrics
  test/         # Testcontainers helpers (Postgres, Redis)
  generated/    # Prisma client (generated, gitignored)
Dockerfile      # multi-stage: `build` (also used by the migrate service) and slim `runtime` (api and worker)
docker-compose.yml
prisma/
  schema.prisma # tenants, conversations, messages
  migrations/
  seed.ts
web/            # React + Vite UI (own package.json, tsconfig and oxlint; ignored by the root ESLint)
  src/api/      # fetch client, types copied from the API (never import backend code), SSE reader
  src/components/ # TenantGate, ChatSimulator, BotSettings
```

Standard error response: `{ "error": { "code", "message", "details"?, "requestId" } }` with codes `VALIDATION_ERROR`, `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `TENANT_NOT_FOUND`, `TENANT_ALREADY_EXISTS`, `INTERNAL_ERROR`.

## Roadmap

1. Setup: TypeScript, tsx, Fastify, ESLint, folder structure
2. `POST /webhooks/:tenantId` (Zod validation, clear 400), `GET /tenants/:tenantId/messages` (in-memory), standard error format
3. PostgreSQL + Prisma (tenants, conversations, messages) + Docker Compose
4. Tests with Vitest + Testcontainers
5. BullMQ queue: async processing with retry, idempotency and dead-letter
6. `LLMProvider` (Gemini + mock), auto-reply streamed via SSE
7. Per-tenant API key auth, Prometheus metrics, CI on GitHub Actions
8. React chat UI: create tenants (`POST /tenants`), send messages as a fake customer through the webhook, and watch replies stream in via SSE
