import { z } from 'zod';

export const replyEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chunk'), replyToId: z.string(), text: z.string() }),
  z.object({ type: z.literal('done'), replyToId: z.string(), text: z.string() }),
]);

export type ReplyEvent = z.infer<typeof replyEventSchema>;

export type ReplyListener = (event: ReplyEvent) => void;

export interface ReplyPublisher {
  publish(tenantId: string, event: ReplyEvent): Promise<void>;
  close(): Promise<void>;
}

export interface ReplySubscriber {
  subscribe(tenantId: string, listener: ReplyListener): Promise<() => Promise<void>>;
  close(): Promise<void>;
}

export function replyChannel(tenantId: string): string {
  return `replies:${tenantId}`;
}
