import { PermanentJobError } from '../../shared/jobs/errors.js';
import type { LLMProvider } from '../llm/llm.provider.js';
import { statusEvent, type ReplyPublisher } from '../replies/reply.events.js';
import type { TenantRepository } from '../tenants/tenant.repository.js';
import type { IncomingMessageJob } from './message.queue.js';
import type { MessageRepository } from './message.repository.js';
import type { Message } from './message.types.js';

export const HISTORY_LIMIT = 10;

export interface ProcessIncomingMessageDeps {
  messageRepository: MessageRepository;
  tenantRepository: TenantRepository;
  llmProvider: LLMProvider;
  replyPublisher: ReplyPublisher;
}

export async function processIncomingMessage(
  job: IncomingMessageJob,
  deps: ProcessIncomingMessageDeps,
  signal?: AbortSignal,
): Promise<void> {
  const inboundMessage = await deps.messageRepository.findByExternalId(
    job.tenantId,
    job.externalId,
  );

  if (!inboundMessage) {
    throw new PermanentJobError(`Message ${job.externalId} from ${job.tenantId} not found`);
  }

  const tenant = await deps.tenantRepository.findById(job.tenantId);
  if (!tenant) {
    throw new PermanentJobError(`Tenant ${job.tenantId} not found`);
  }

  const publishStatus = (
    stage: Parameters<typeof statusEvent>[1],
    detail?: Parameters<typeof statusEvent>[3],
  ) =>
    deps.replyPublisher.publish(job.tenantId, statusEvent(job.externalId, stage, 'worker', detail));

  const history = await deps.messageRepository.listConversationBefore(
    inboundMessage,
    HISTORY_LIMIT,
  );

  await publishStatus('generating', { tenant: tenant.name, historyMessages: history.length });
  const startedAt = performance.now();

  let text = '';
  let chunks = 0;
  for await (const chunk of deps.llmProvider.generateReply({
    text: inboundMessage.text,
    history: history.map((message) => ({
      role: message.direction === 'inbound' ? 'customer' : 'assistant',
      text: message.text,
    })),
    tenant: { name: tenant.name, instructions: tenant.botInstructions },
    signal,
  })) {
    if (chunks === 0) {
      await publishStatus('first_token', {
        latencyMs: Math.round(performance.now() - startedAt),
      });
    }
    chunks += 1;
    text += chunk;
    await deps.replyPublisher.publish(inboundMessage.tenantId, {
      type: 'chunk',
      replyToId: inboundMessage.id,
      text: chunk,
    });
  }

  const reply: Message = {
    id: crypto.randomUUID(),
    tenantId: inboundMessage.tenantId,
    channel: inboundMessage.channel,
    from: inboundMessage.from,
    text,
    direction: 'outbound',
    sentAt: new Date(),
    receivedAt: new Date(),
    replyToId: inboundMessage.id,
  };

  await deps.messageRepository.save(reply);
  await publishStatus('saved', {
    chunks,
    llmMs: Math.round(performance.now() - startedAt),
  });
  await deps.replyPublisher.publish(inboundMessage.tenantId, {
    type: 'done',
    replyToId: inboundMessage.id,
    text,
  });
}
