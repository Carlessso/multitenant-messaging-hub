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
