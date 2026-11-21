import { GoogleGenAI } from '@google/genai';
import type { GenerateReplyInput, LLMProvider, ReplyTenantContext } from './llm.provider.js';

export class GeminiLLMProvider implements LLMProvider {
  private readonly ai: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async *generateReply({ text, tenant, signal }: GenerateReplyInput): AsyncIterable<string> {
    const stream = await this.ai.models.generateContentStream({
      model: this.model,
      contents: text,
      config: {
        abortSignal: signal,
        systemInstruction: buildSystemInstruction(tenant),
      },
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  }
}

export function buildSystemInstruction(tenant: ReplyTenantContext): string {
  return [
    `You are the customer service assistant of "${tenant.name}", replying to a customer on a messaging app.`,
    tenant.instructions
      ? `Instructions from the store owner:\n"""\n${tenant.instructions}\n"""`
      : undefined,
    'Always reply in the same language as the customer, in a friendly tone, in at most three short sentences.',
    'Never make up prices, opening hours, stock or policies that are not stated above; say that a team member will follow up instead.',
  ]
    .filter(Boolean)
    .join('\n\n');
}
