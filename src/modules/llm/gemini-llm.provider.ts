import { GoogleGenAI, type Content } from '@google/genai';
import type {
  ConversationTurn,
  GenerateReplyInput,
  LLMProvider,
  ReplyTenantContext,
} from './llm.provider.js';

export class GeminiLLMProvider implements LLMProvider {
  private readonly ai: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async *generateReply({
    text,
    history,
    tenant,
    signal,
  }: GenerateReplyInput): AsyncIterable<string> {
    const stream = await this.ai.models.generateContentStream({
      model: this.model,
      contents: toGeminiContents(history, text),
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
    'Use the earlier messages of the conversation as context and continue it naturally; do not greet the customer again if you already did.',
    'Never make up prices, opening hours, stock or policies that are not stated above; say that a team member will follow up instead.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function toGeminiContents(history: ConversationTurn[], text: string): Content[] {
  const turns: ConversationTurn[] = [...history, { role: 'customer', text }];
  const contents: Content[] = [];

  for (const turn of turns) {
    const role = turn.role === 'customer' ? 'user' : 'model';
    const previous = contents.at(-1);

    if (!previous && role === 'model') {
      continue;
    }
    if (previous?.role === role) {
      previous.parts = [...(previous.parts ?? []), { text: turn.text }];
      continue;
    }
    contents.push({ role, parts: [{ text: turn.text }] });
  }

  return contents;
}
