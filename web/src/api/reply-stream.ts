import { ApiError, authHeaders } from './client.ts';
import type { ReplyEvent, Session } from './types.ts';

export async function* streamReplies(
  session: Session,
  signal: AbortSignal,
  onOpen?: () => void,
): AsyncGenerator<ReplyEvent> {
  const response = await fetch(`/tenants/${session.tenantId}/replies/stream`, {
    headers: authHeaders(session.apiKey),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new ApiError(response.status, 'STREAM_FAILED', 'Could not open the reply stream');
  }
  onOpen?.();

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        return;
      }

      buffer += value;
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const event = parseEvent(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (event) {
          yield event;
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseEvent(raw: string): ReplyEvent | null {
  const data = raw
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart())
    .join('\n');

  return data ? (JSON.parse(data) as ReplyEvent) : null;
}
