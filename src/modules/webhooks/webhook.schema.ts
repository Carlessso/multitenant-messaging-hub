import { z } from 'zod';
import { channelSchema } from '../../shared/channel.schema.js';

export const webhookMessageSchema = z.object({
  externalId: z.string().min(1).max(255),
  channel: channelSchema,
  from: z.object({
    id: z.string().min(1).max(100),
    name: z.string().max(255).optional(),
  }),
  text: z.string().min(1).max(4096),
  sentAt: z.iso.datetime(),
});

export type WebhookMessage = z.infer<typeof webhookMessageSchema>;
