import { MockLLMProvider } from './mock-llm.provider.js';
import { describe, expect, it } from 'vitest';

describe('MockLLMProvider', () => {
  it('streams the echoed message in more than one chunk', async () => {
    const llmProvider = new MockLLMProvider(0);

    const clientMessage = 'Olá, boa tarde';

    const chunks: string[] = [];
    for await (const chunk of llmProvider.generateReply({
      text: clientMessage,
      tenant: { name: 'Loja X', instructions: null },
    })) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(`Echo: ${clientMessage}`);
  });
});
