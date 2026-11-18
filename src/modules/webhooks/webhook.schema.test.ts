import { describe, it, expect } from 'vitest';
import { webhookMessageSchema } from './webhook.schema.js';

const validPayload = {
  externalId: 'wamid.HBgLNTUxMTk5OTk5OTk5FQIAERgSQzRBMjE2',
  channel: 'whatsapp',
  from: {
    id: '5511999999999',
    name: 'Maria Silva',
  },
  text: 'Oi, vocês abrem no sábado?',
  sentAt: '2026-11-18T14:30:00.000Z',
};

describe('webhookMessageSchema', () => {
  it('accepts a valid payload', () => {
    const result = webhookMessageSchema.safeParse(validPayload);

    expect(result.success).toBe(true);
  });

  it('accepts payload without from.name optional attr', () => {
    const withoutFromPayload = { ...validPayload, from: { id: '51999999999' } };
    const result = webhookMessageSchema.safeParse(withoutFromPayload);

    expect(result.success).toBe(true);
  });

  it('rejects invalid channel', () => {
    const invalidChannelPayload = { ...validPayload, channel: 'telegram' };
    const result = webhookMessageSchema.safeParse(invalidChannelPayload);

    expect(result.success).toBe(false);
  });

  it('rejects undefined text', () => {
    const invalidTextPayload = { ...validPayload, text: undefined };
    const result = webhookMessageSchema.safeParse(invalidTextPayload);

    expect(result.success).toBe(false);
  });

  it('rejects empty string text', () => {
    const invalidTextPayload = { ...validPayload, text: '' };
    const result = webhookMessageSchema.safeParse(invalidTextPayload);

    expect(result.success).toBe(false);
  });
});
