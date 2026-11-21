[← Back to the README](../README.md)

# Development

## Docker stack

| Service    | What it does                                                 | Address                 |
| ---------- | ------------------------------------------------------------ | ----------------------- |
| `postgres` | PostgreSQL 18                                                | `127.0.0.1:5432`        |
| `redis`    | Redis 8 (queue and pub/sub)                                  | `127.0.0.1:6379`        |
| `migrate`  | One-shot: applies the migrations and seeds the dev tenants   | —                       |
| `api`      | Fastify API (starts once `migrate` succeeded)                | `http://127.0.0.1:3000` |
| `worker`   | Queue worker that generates the replies                      | —                       |
| `web`      | React UI served by nginx, which also proxies the API and SSE | `http://127.0.0.1:8080` |

Services start in dependency order with health checks, every port is bound to `127.0.0.1` only, and every service shuts down gracefully. The worker uses the mock LLM unless `LLM_PROVIDER=gemini` and `GEMINI_API_KEY` are set in `.env` (run `bin/restart` after editing it). The admin key for creating tenants defaults to `local-admin-key-change-me` (override it with `ADMIN_API_KEY` in `.env`).

| Command                             | Effect                                                         |
| ----------------------------------- | -------------------------------------------------------------- |
| `bin/setup`                         | Build and start everything, waiting for the health checks      |
| `bin/restart`                       | Rebuild and recreate the containers after code or `.env` edits |
| `bin/stop`                          | Stop all containers, keeping the data                          |
| `bin/stop --wipe`                   | Remove the containers and wipe PostgreSQL and Redis data       |
| `docker compose up --build -d`      | Build (if the code changed) and start everything in background |
| `docker compose stop`               | Stop all containers, keeping them and the data                 |
| `docker compose start`              | Start the stopped containers again                             |
| `docker compose ps`                 | List the services and their health                             |
| `docker compose logs -f api worker` | Follow the logs of some services                               |
| `docker compose down`               | Stop and remove the containers (data volumes are kept)         |
| `docker compose down -v`            | Same, and also wipe PostgreSQL and Redis data                  |

## Running the API and worker with Node

Requirements: Node.js 26 (`nvm use`), Docker.

```bash
npm install
cp .env.example .env

docker compose up -d postgres redis   # only the infrastructure
npm run db:migrate                    # apply migrations
npm run db:generate                   # generate the Prisma client
npm run db:seed                       # create the dev tenants: loja-x, padaria-do-joao

npm run dev                           # API on http://127.0.0.1:3000, with reload
npm run dev:worker                    # worker, in another terminal
```

Do not run the full Docker stack at the same time: its `api` container also uses port 3000.

The seed gives the dev tenants fixed API keys, for local use only: `hub_dev_loja-x` and `hub_dev_padaria-do-joao`. To create tenants through the API, set `ADMIN_API_KEY` (16+ characters) in `.env`.

By default the worker uses the mock LLM, which needs no API key. To use Gemini, create a key in Google AI Studio and set in `.env`:

```bash
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-key
# GEMINI_MODEL=gemini-3.8-flash
# LLM_TIMEOUT_MS=60000
```

### Web UI

```bash
cd web
npm install
npm run dev                 # http://127.0.0.1:5173 (API and worker must be running)
```

- **Pick a demo store** to go straight to the chat. Under _Use your own tenant_ you can also open any tenant with its id and API key, or create one with the `ADMIN_API_KEY` (the new tenant's key is shown once).
- **Chat** plays the customer: pick a phone number and channel, send messages through the webhook and watch the reply arrive chunk by chunk.
- **Bot settings** edits the tenant's bot instructions.

Vite proxies `/tenants` and `/webhooks` to the API, so the browser sees a single origin and no CORS setup is needed. The reply stream is read with `fetch` and a stream reader instead of `EventSource`, which cannot send the `Authorization` header. On every (re)connection the UI reloads the history, covering events missed while disconnected. Gemini tends to send a reply in a few large chunks after its thinking time, so the UI reveals the received text progressively (typewriter style); the real chunks, as they arrived, are listed in the HTTP & SSE panel.

## Tests

```bash
npm test              # run once
npm run test:watch    # watch mode
```

- **Unit tests** cover the Zod schemas, the streaming mock LLM and how the Gemini prompt is built (system instruction and conversation turns).
- **Integration tests** start PostgreSQL 18 and Redis 8 containers with Testcontainers and apply the migrations with `prisma migrate deploy`. They call the API through `app.inject()` and assert the HTTP response, what was persisted and what was enqueued. The SSE test listens on a random port and reads the stream with `fetch`, checking that events reach the right tenant only.
- **Processor tests** call `processIncomingMessage` directly against the database with the mock LLM: reply text, published chunks and `done` event, the tenant's name, instructions and conversation history reaching the LLM, the pipeline status events, idempotency when the same job runs twice, a permanent error when the message does not exist, and the timeout aborting a slow LLM without saving a reply.
- **Auth, settings and metrics tests** cover `401`/`403`, tenant creation returning a working key, `409` on duplicates, reading and updating the bot instructions (including the 2000-character limit), and the Prometheus output after real traffic.

Docker must be running. The same suite runs on GitHub Actions on every push.

## Scripts

| Script                                   | Description                                      |
| ---------------------------------------- | ------------------------------------------------ |
| `dev` / `dev:worker`                     | Run the API / worker with `tsx watch` and `.env` |
| `build` / `start` / `start:worker`       | Compile to `dist/` and run with plain Node       |
| `typecheck`                              | `tsc --noEmit`                                   |
| `lint` / `format`                        | ESLint / Prettier                                |
| `test` / `test:watch`                    | Vitest                                           |
| `db:migrate` / `db:generate` / `db:seed` | Prisma migrations, client generation and seed    |
