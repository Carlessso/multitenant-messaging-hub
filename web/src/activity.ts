import type { HttpLogEntry } from './api/http-log.ts';
import type { ReplyEvent, StatusDetail } from './api/types.ts';

export interface TimelineEntry {
  stage: string;
  source: 'browser' | 'api' | 'worker';
  at: string;
  detail?: StatusDetail;
}

export interface MessageTimeline {
  externalId: string;
  text: string;
  entries: TimelineEntry[];
}

export type WireEntry =
  | ({ id: number; kind: 'http' } & HttpLogEntry)
  | { id: number; kind: 'sse'; at: string; event: ReplyEvent };

export const MAX_TIMELINES = 20;
export const MAX_WIRE_ENTRIES = 150;

export function addTimelineEntry(
  timelines: MessageTimeline[],
  externalId: string,
  entry: TimelineEntry,
  text = '',
): MessageTimeline[] {
  const existing = timelines.find((timeline) => timeline.externalId === externalId);
  if (!existing) {
    return [{ externalId, text, entries: [entry] }, ...timelines].slice(0, MAX_TIMELINES);
  }

  return timelines.map((timeline) =>
    timeline === existing
      ? {
          ...timeline,
          text: timeline.text || text,
          entries: [...timeline.entries, entry].sort((a, b) => a.at.localeCompare(b.at)),
        }
      : timeline,
  );
}
