import { z } from 'zod';

export const PIPELINE_STAGES = [
  'received',
  'enqueued',
  'processing',
  'generating',
  'first_token',
  'saved',
  'failed',
  'dead_lettered',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const replyEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chunk'), replyToId: z.string(), text: z.string() }),
  z.object({ type: z.literal('done'), replyToId: z.string(), text: z.string() }),
  z.object({
    type: z.literal('status'),
    externalId: z.string(),
    stage: z.enum(PIPELINE_STAGES),
    source: z.enum(['api', 'worker']),
    at: z.string(),
    detail: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  }),
]);

export type ReplyEvent = z.infer<typeof replyEventSchema>;
export type StatusEvent = Extract<ReplyEvent, { type: 'status' }>;

export function statusEvent(
  externalId: string,
  stage: PipelineStage,
  source: StatusEvent['source'],
  detail?: StatusEvent['detail'],
): StatusEvent {
  return {
    type: 'status',
    externalId,
    stage,
    source,
    at: new Date().toISOString(),
    ...(detail ? { detail } : {}),
  };
}

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
