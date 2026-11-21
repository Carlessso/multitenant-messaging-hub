export interface GenerateReplyInput {
  text: string;
  tenantId: string;
  signal?: AbortSignal;
}

export interface LLMProvider {
  generateReply(input: GenerateReplyInput): AsyncIterable<string>;
}
