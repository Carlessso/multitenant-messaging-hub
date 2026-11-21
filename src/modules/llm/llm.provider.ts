export interface ReplyTenantContext {
  name: string;
  instructions: string | null;
}

export interface GenerateReplyInput {
  text: string;
  tenant: ReplyTenantContext;
  signal?: AbortSignal;
}

export interface LLMProvider {
  generateReply(input: GenerateReplyInput): AsyncIterable<string>;
}
