import type { IncomingMessageJob } from './message.queue.js';
import type { MessageRepository } from './message.repository.js';
import type { Message } from './message.types.js';

export interface ProcessIncomingMessageDeps {
  messageRepository: MessageRepository;
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
    throw new Error(`Message ${job.externalId} from ${job.tenantId} not found`);
  }

  const reply: Message = {
    id: crypto.randomUUID(),
    tenantId: inboundMessage.tenantId,
    channel: inboundMessage.channel,
    from: inboundMessage.from,
    text: "Thanks for your message! We'll get back to you soon.",
    direction: 'outbound',
    sentAt: new Date(),
    receivedAt: new Date(),
    replyToId: inboundMessage.id,
  };

  await deps.messageRepository.save(reply);
}
