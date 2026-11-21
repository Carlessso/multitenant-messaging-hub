import { setTimeout } from 'node:timers/promises';
import type { GenerateReplyInput, LLMProvider } from './llm.provider.js';

export class MockLLMProvider implements LLMProvider {
  constructor(private readonly delayMs = 50) {}

  async *generateReply({ text, signal }: GenerateReplyInput): AsyncIterable<string> {
    const words = `Echo: ${text}`.split(' ');

    for (const [index, word] of words.entries()) {
      await setTimeout(this.delayMs, undefined, { signal });
      yield index === 0 ? word : ` ${word}`;
    }
  }
}
