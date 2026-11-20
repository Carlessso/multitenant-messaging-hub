export interface LLMProvider {
  generateReply(clientMessage: string, tenantId: string): AsyncIterable<string>;
}
