[← Back to the README](../README.md)

# API

Tenant routes require the tenant's API key: `Authorization: Bearer <api-key>`.

## `POST /tenants` (admin)

```bash
curl -X POST http://127.0.0.1:3000/tenants \
  -H 'authorization: Bearer <ADMIN_API_KEY>' \
  -H 'content-type: application/json' \
  -d '{ "id": "sorveteria-ana", "name": "Sorveteria da Ana" }'
```

```json
{ "id": "sorveteria-ana", "name": "Sorveteria da Ana", "apiKey": "hub_..." }
```

Returns `201 Created`. The API key is shown only in this response; store it. `409 TENANT_ALREADY_EXISTS` if the id is taken.

## `POST /webhooks/:tenantId`

```bash
curl -X POST http://127.0.0.1:3000/webhooks/loja-x \
  -H 'content-type: application/json' \
  -d '{
    "externalId": "wamid.123",
    "channel": "whatsapp",
    "from": { "id": "5511999999999", "name": "Maria Silva" },
    "text": "Hi, are you open on Saturday?",
    "sentAt": "2026-11-18T14:30:00.000Z"
  }'
```

```json
{ "received": true }
```

Returns `202 Accepted`: the message is stored and queued, and the reply is produced asynchronously by the worker. `channel` is `whatsapp` or `instagram`, `from.name` is optional and `sentAt` is an ISO 8601 UTC datetime.

## `GET` / `PUT /tenants/:tenantId/settings`

```bash
curl -X PUT http://127.0.0.1:3000/tenants/loja-x/settings \
  -H 'authorization: Bearer hub_dev_loja-x' \
  -H 'content-type: application/json' \
  -d '{ "botInstructions": "You are the assistant of Loja X. Answer cordially." }'
```

```json
{
  "id": "loja-x",
  "name": "Loja X",
  "botInstructions": "You are the assistant of Loja X. Answer cordially."
}
```

`botInstructions` is up to 2000 characters; `null` or an empty string clears it. `GET` returns the same profile. `POST /tenants` also accepts an optional `botInstructions`.

## `GET /tenants/:tenantId/messages`

```bash
curl http://127.0.0.1:3000/tenants/loja-x/messages -H 'authorization: Bearer hub_dev_loja-x'
```

Returns the tenant's messages ordered by arrival. Replies have `direction: "outbound"` and a `replyToId` pointing to the message they answer:

```json
{
  "data": [
    {
      "id": "036e804e-...",
      "tenantId": "loja-x",
      "externalId": "wamid.123",
      "channel": "whatsapp",
      "from": { "id": "5511999999999", "name": "Maria Silva" },
      "text": "Hi, are you open on Saturday?",
      "direction": "inbound",
      "sentAt": "2026-11-18T14:30:00.000Z",
      "receivedAt": "2026-11-18T14:30:01.123Z"
    },
    {
      "id": "2f7cb5c3-...",
      "tenantId": "loja-x",
      "channel": "whatsapp",
      "from": { "id": "5511999999999", "name": "Maria Silva" },
      "text": "Hi! A team member will confirm our Saturday hours shortly.",
      "direction": "outbound",
      "sentAt": "2026-11-18T14:30:01.160Z",
      "receivedAt": "2026-11-18T14:30:01.160Z",
      "replyToId": "036e804e-..."
    }
  ]
}
```

## `GET /tenants/:tenantId/replies/stream`

Server-Sent Events stream of the tenant's replies while they are being generated. Each chunk is sent as soon as the LLM produces it; `done` carries the full text once the reply is saved.

```bash
curl -N http://127.0.0.1:3000/tenants/loja-x/replies/stream -H 'authorization: Bearer hub_dev_loja-x'
```

```text
: connected

event: chunk
data: {"type":"chunk","replyToId":"036e804e-...","text":"Hi! A team member"}

event: chunk
data: {"type":"chunk","replyToId":"036e804e-...","text":" will confirm our Saturday hours shortly."}

event: done
data: {"type":"done","replyToId":"036e804e-...","text":"Hi! A team member will confirm our Saturday hours shortly."}
```

In the browser, use `fetch` and read `response.body` as a stream: the native `EventSource` cannot send the `Authorization` header.

## `GET /metrics`

Prometheus text format: `nodejs_*`/`process_*` runtime metrics, `http_request_duration_seconds{method,route,status_code}`, `queue_jobs{state}` (`waiting`, `active`, `delayed`, `failed`, `deadLetter`) and `sse_connections`.

## `GET /health`

```json
{ "status": "ok" }
```

## Error format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "path": "body.channel",
        "message": "Invalid option: expected one of \"whatsapp\"|\"instagram\""
      }
    ],
    "requestId": "req-1"
  }
}
```

| Code                    | Status | When                                                   |
| ----------------------- | ------ | ------------------------------------------------------ |
| `VALIDATION_ERROR`      | 400    | Params or body fail schema validation                  |
| `BAD_REQUEST`           | 4xx    | Malformed request (e.g. invalid JSON)                  |
| `UNAUTHORIZED`          | 401    | Missing or invalid API key                             |
| `FORBIDDEN`             | 403    | API key belongs to another tenant                      |
| `NOT_FOUND`             | 404    | Unknown route                                          |
| `TENANT_NOT_FOUND`      | 404    | Unknown tenant on the webhook                          |
| `TENANT_ALREADY_EXISTS` | 409    | Creating a tenant with an id that is taken             |
| `INTERNAL_ERROR`        | 500    | Unexpected failure (details are logged, never exposed) |
