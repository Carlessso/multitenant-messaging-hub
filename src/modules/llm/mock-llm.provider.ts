import { setTimeout } from 'node:timers/promises';
import type { LLMProvider } from './llm.provider.js';

export class MockLLMProvider implements LLMProvider {
  constructor(private readonly delayMs = 50) {}

  async *generateReply(clientMessage: string): AsyncIterable<string> {
    const words = `Echo: ${clientMessage}`.split(' ');

    for (const [index, word] of words.entries()) {
      await setTimeout(this.delayMs);
      yield index === 0 ? word : ` ${word}`;
    }
  }
}
