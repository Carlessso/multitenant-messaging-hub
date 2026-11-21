import { PermanentJobError } from '../../shared/jobs/errors.js';
import type { LLMProvider } from '../llm/llm.provider.js';
import type { ReplyPublisher } from '../replies/reply.events.js';
import type { TenantRepository } from '../tenants/tenant.repository.js';
import type { IncomingMessageJob } from './message.queue.js';
import type { MessageRepository } from './message.repository.js';
import type { Message } from './message.types.js';

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

  let text = '';
  for await (const chunk of deps.llmProvider.generateReply({
    text: inboundMessage.text,
    tenant: { name: tenant.name, instructions: tenant.botInstructions },
    signal,
  })) {
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
  await deps.replyPublisher.publish(inboundMessage.tenantId, {
    type: 'done',
    replyToId: inboundMessage.id,
    text,
  });
}
