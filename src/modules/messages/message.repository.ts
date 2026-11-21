import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import type { Message } from './message.types.js';

export interface MessageRepository {
  save(message: Message): Promise<void>;
  listByTenant(tenantId: string): Promise<Message[]>;
  findByExternalId(tenantId: string, externalId: string): Promise<Message | null>;
  listConversationBefore(message: Message, limit: number): Promise<Message[]>;
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

    try {
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
          replyToId: message.replyToId,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return; // already saved: duplicate delivery, nothing to do
      }
      throw error;
    }
  }

  async listByTenant(tenantId: string): Promise<Message[]> {
    const rows = await this.prisma.message.findMany({
      where: { tenantId },
      orderBy: { receivedAt: 'asc' },
      include: { conversation: true },
    });

    return rows.map(toEntity);
  }

  async findByExternalId(tenantId: string, externalId: string): Promise<Message | null> {
    const row = await this.prisma.message.findUnique({
      where: {
        tenantId_externalId: {
          tenantId,
          externalId,
        },
      },
      include: { conversation: true },
    });

    return row ? toEntity(row) : null;
  }

  async listConversationBefore(message: Message, limit: number): Promise<Message[]> {
    const rows = await this.prisma.message.findMany({
      where: {
        tenantId: message.tenantId,
        receivedAt: { lt: message.receivedAt },
        conversation: { channel: message.channel, contactId: message.from.id },
      },
      orderBy: { receivedAt: 'desc' },
      take: limit,
      include: { conversation: true },
    });

    return rows.reverse().map(toEntity);
  }
}

type MessageRow = Prisma.MessageGetPayload<{ include: { conversation: true } }>;

function toEntity(row: MessageRow): Message {
  return {
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
    replyToId: row.replyToId ?? undefined,
  };
}
