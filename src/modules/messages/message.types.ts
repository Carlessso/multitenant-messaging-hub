import type { Channel } from '../../shared/channel.schema.js';

export type Message = {
  id: string;
  tenantId: string;
  externalId?: string;
  channel: Channel;
  from: {
    id: string;
    name?: string;
  };
  text: string;
  direction: 'outbound' | 'inbound';
  sentAt: Date;
  receivedAt: Date;
};
