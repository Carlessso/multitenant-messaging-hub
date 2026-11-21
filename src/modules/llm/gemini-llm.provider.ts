import { GoogleGenAI } from '@google/genai';
import type { GenerateReplyInput, LLMProvider } from './llm.provider.js';

export class GeminiLLMProvider implements LLMProvider {
  private readonly ai: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async *generateReply({ text, tenantId, signal }: GenerateReplyInput): AsyncIterable<string> {
    const stream = await this.ai.models.generateContentStream({
      model: this.model,
      contents: text,
      config: {
        abortSignal: signal,
        systemInstruction: [
          `You are the customer service assistant of the store "${tenantId}", replying to a customer on a messaging app.`,
          'Reply in the same language as the customer, in a friendly tone, in at most three short sentences.',
          'If you do not know something specific about the store (prices, hours, stock), say that a team member will follow up instead of making it up.',
        ].join(' '),
      },
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  }
}
