import type { CreatedTenant, Customer, Message, Session, TenantProfile } from './types.ts';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT';
  apiKey?: string;
  body?: unknown;
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

export function authHeaders(apiKey: string | undefined): Record<string, string> {
  return apiKey ? { authorization: `Bearer ${apiKey}` } : {};
}

async function request<T>(path: string, { method = 'GET', apiKey, body }: RequestOptions = {}) {
  const response = await fetch(path, {
    method,
    headers: {
      ...authHeaders(apiKey),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = (data as ErrorEnvelope | undefined)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? `Request failed with status ${response.status}`,
    );
  }

  return data as T;
}

export const api = {
  getSettings(session: Session) {
    return request<TenantProfile>(`/tenants/${session.tenantId}/settings`, {
      apiKey: session.apiKey,
    });
  },

  updateSettings(session: Session, botInstructions: string | null) {
    return request<TenantProfile>(`/tenants/${session.tenantId}/settings`, {
      method: 'PUT',
      apiKey: session.apiKey,
      body: { botInstructions },
    });
  },

  createTenant(
    adminApiKey: string,
    input: { id: string; name: string; botInstructions: string | null },
  ) {
    return request<CreatedTenant>('/tenants', {
      method: 'POST',
      apiKey: adminApiKey,
      body: input,
    });
  },

  async listMessages(session: Session) {
    const response = await request<{ data: Message[] }>(`/tenants/${session.tenantId}/messages`, {
      apiKey: session.apiKey,
    });
    return response.data;
  },

  sendCustomerMessage(tenantId: string, customer: Customer, text: string) {
    return request<{ received: boolean }>(`/webhooks/${tenantId}`, {
      method: 'POST',
      body: {
        externalId: `sim.${crypto.randomUUID()}`,
        channel: customer.channel,
        from: { id: customer.id, name: customer.name || undefined },
        text,
        sentAt: new Date().toISOString(),
      },
    });
  },
};
