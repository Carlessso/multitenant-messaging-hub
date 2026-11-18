import type { PrismaClient } from '../../generated/prisma/client.js';
import type { Message } from './message.types.js';

export interface MessageRepository {
  save(message: Message): Promise<void>;
  listByTenant(tenantId: string): Promise<Message[]>;
}

export class InMemoryMessageRepository implements MessageRepository {
  private readonly messagesByTenant = new Map<string, Message[]>();

  async save(message: Message): Promise<void> {
    const messages = this.messagesByTenant.get(message.tenantId) ?? [];
    this.messagesByTenant.set(message.tenantId, [...messages, message]);
  }

  async listByTenant(tenantId: string): Promise<Message[]> {
    const messages = this.messagesByTenant.get(tenantId) ?? [];
    return [...messages];
  }
}

export class PrismaMessageRepository implements MessageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(message: Message): Promise<void> {
    const conversation = await this.prisma.conversation.upsert({
      where: {
        tenantId_channel_contactId: {
          tenantId: message.tenantId,
          channel: message.channel,
          contactId: message.from.id,
        },
      },
      create: {
        tenantId: message.tenantId,
        channel: message.channel,
        contactId: message.from.id,
        contactName: message.from.name,
      },
      update: {
        contactName: message.from.name,
      },
    });

    await this.prisma.message.create({
      data: {
        id: message.id,
        tenantId: message.tenantId,
        conversationId: conversation.id,
        externalId: message.externalId,
        direction: message.direction,
        text: message.text,
        sentAt: message.sentAt,
        receivedAt: message.receivedAt,
      },
    });
  }

  async listByTenant(tenantId: string): Promise<Message[]> {
    const rows = await this.prisma.message.findMany({
      where: { tenantId },
      orderBy: { receivedAt: 'asc' },
      include: { conversation: true },
    });

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      externalId: row.externalId ?? undefined,
      channel: row.conversation.channel,
      from: {
        id: row.conversation.contactId,
        name: row.conversation.contactName ?? undefined,
      },
      text: row.text,
      direction: row.direction,
      sentAt: row.sentAt,
      receivedAt: row.receivedAt,
    }));
  }
}
