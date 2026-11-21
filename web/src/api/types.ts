export type Channel = 'whatsapp' | 'instagram';

export interface Message {
  id: string;
  tenantId: string;
  externalId?: string;
  channel: Channel;
  from: { id: string; name?: string };
  text: string;
  direction: 'inbound' | 'outbound';
  sentAt: string;
  receivedAt: string;
  replyToId?: string;
}

export type StatusDetail = Record<string, string | number | boolean>;

export type ReplyEvent =
  | { type: 'chunk' | 'done'; replyToId: string; text: string }
  | {
      type: 'status';
      externalId: string;
      stage: string;
      source: 'api' | 'worker';
      at: string;
      detail?: StatusDetail;
    };

export interface TenantProfile {
  id: string;
  name: string;
  botInstructions: string | null;
}

export interface CreatedTenant extends TenantProfile {
  apiKey: string;
}

export interface Session {
  tenantId: string;
  apiKey: string;
}

export interface Customer {
  id: string;
  name: string;
  channel: Channel;
}
