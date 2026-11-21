import { GoogleGenAI } from '@google/genai';
import type { LLMProvider } from './llm.provider.js';

export class GeminiLLMProvider implements LLMProvider {
  private readonly ai: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async *generateReply(clientMessage: string, tenantId: string): AsyncIterable<string> {
    const stream = await this.ai.models.generateContentStream({
      model: this.model,
      contents: clientMessage,
      config: {
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
