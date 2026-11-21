export interface ReplyTenantContext {
  name: string;
  instructions: string | null;
}

export interface ConversationTurn {
  role: 'customer' | 'assistant';
  text: string;
}

export interface GenerateReplyInput {
  text: string;
  history: ConversationTurn[];
  tenant: ReplyTenantContext;
  signal?: AbortSignal;
}

export interface LLMProvider {
  generateReply(input: GenerateReplyInput): AsyncIterable<string>;
}
