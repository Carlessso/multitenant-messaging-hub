import { PermanentJobError } from '../../shared/jobs/errors.js';
import type { LLMProvider } from '../llm/llm.provider.js';
import type { IncomingMessageJob } from './message.queue.js';
import type { MessageRepository } from './message.repository.js';
import type { Message } from './message.types.js';

export interface ProcessIncomingMessageDeps {
  messageRepository: MessageRepository;
  llmProvider: LLMProvider;
}

export async function processIncomingMessage(
  job: IncomingMessageJob,
  deps: ProcessIncomingMessageDeps,
): Promise<void> {
  const inboundMessage = await deps.messageRepository.findByExternalId(
    job.tenantId,
    job.externalId,
  );

  if (!inboundMessage) {
    throw new PermanentJobError(`Message ${job.externalId} from ${job.tenantId} not found`);
  }

  let text = '';
  for await (const chunk of deps.llmProvider.generateReply(
    inboundMessage.text,
    inboundMessage.tenantId,
  )) {
    text += chunk;
  }

  const reply: Message = {
    id: crypto.randomUUID(),
    tenantId: inboundMessage.tenantId,
    channel: inboundMessage.channel,
    from: inboundMessage.from,
    text: text,
    direction: 'outbound',
    sentAt: new Date(),
    receivedAt: new Date(),
    replyToId: inboundMessage.id,
  };

  await deps.messageRepository.save(reply);
}
