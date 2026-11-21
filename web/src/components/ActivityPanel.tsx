import { useState } from 'react';
import type { StatusDetail } from '../api/types.ts';
import type { MessageTimeline, TimelineEntry, WireEntry } from '../activity.ts';

interface ActivityPanelProps {
  timelines: MessageTimeline[];
  wire: WireEntry[];
}

type Tab = 'pipeline' | 'wire';

const STAGE_LABELS: Record<string, string> = {
  sent: 'Customer sent the message',
  received: 'API validated and saved it',
  enqueued: 'Job added to the queue',
  accepted: 'Webhook answered 202',
  processing: 'Worker picked the job',
  generating: 'Calling the LLM',
  first_token: 'First token from the LLM',
  saved: 'Reply saved to PostgreSQL',
  delivered: 'Reply rendered in the browser',
  failed: 'Attempt failed',
  dead_lettered: 'Moved to the dead-letter queue',
};

const ERROR_STAGES = new Set(['failed', 'dead_lettered']);

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function formatDetail(detail: StatusDetail): string[] {
  return Object.entries(detail).map(([key, value]) =>
    typeof value === 'number' && /ms$/i.test(key)
      ? `${key.replace(/ms$/i, '')} ${formatDuration(value)}`
      : `${key} ${String(value)}`,
  );
}

function clock(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleTimeString([], { hour12: false })}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}

function TimelineRow({ entry, origin }: { entry: TimelineEntry; origin: number }) {
  const offset = new Date(entry.at).getTime() - origin;
  return (
    <li className={ERROR_STAGES.has(entry.stage) ? 'step error-step' : 'step'}>
      <span className="step-offset">+{formatDuration(Math.max(offset, 0))}</span>
      <div>
        <div className="step-title">
          <span className={`source ${entry.source}`}>{entry.source}</span>
          {STAGE_LABELS[entry.stage] ?? entry.stage}
        </div>
        {entry.detail && (
          <div className="chips">
            {formatDetail(entry.detail).map((chip) => (
              <span className="chip" key={chip}>
                {chip}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function wireSummary(entry: WireEntry): { label: string; meta: string; error: boolean } {
  if (entry.kind === 'http') {
    return {
      label: `${entry.method} ${entry.path}`,
      meta: `${entry.status ?? 'network error'} · ${formatDuration(entry.durationMs)}`,
      error: entry.status === null || entry.status >= 400,
    };
  }

  const { event } = entry;
  if (event.type === 'status') {
    return { label: `SSE status · ${event.stage}`, meta: event.source, error: false };
  }
  return {
    label: `SSE ${event.type}`,
    meta: event.type === 'chunk' ? JSON.stringify(event.text) : `${event.text.length} chars`,
    error: false,
  };
}

export function ActivityPanel({ timelines, wire }: ActivityPanelProps) {
  const [tab, setTab] = useState<Tab>('pipeline');

  return (
    <aside className="activity card">
      <header className="activity-header">
        <h2>Backend activity</h2>
        <nav className="tabs">
          <button
            type="button"
            className={tab === 'pipeline' ? 'tab active' : 'tab'}
            onClick={() => setTab('pipeline')}
          >
            Pipeline
          </button>
          <button
            type="button"
            className={tab === 'wire' ? 'tab active' : 'tab'}
            onClick={() => setTab('wire')}
          >
            HTTP &amp; SSE
          </button>
        </nav>
      </header>

      {tab === 'pipeline' && (
        <div className="activity-body">
          {timelines.length === 0 && (
            <p className="hint">
              Send a message to follow it through the webhook, the queue, the worker and the LLM.
            </p>
          )}
          {timelines.map((timeline) => {
            const origin = new Date(timeline.entries[0]?.at ?? 0).getTime();
            return (
              <section className="timeline" key={timeline.externalId}>
                <h3 title={timeline.externalId}>“{timeline.text || timeline.externalId}”</h3>
                <ol>
                  {timeline.entries.map((entry, index) => (
                    <TimelineRow key={`${entry.stage}-${index}`} entry={entry} origin={origin} />
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      )}

      {tab === 'wire' && (
        <div className="activity-body">
          {wire.length === 0 && <p className="hint">No traffic yet.</p>}
          <ul className="wire">
            {wire.map((entry) => {
              const summary = wireSummary(entry);
              return (
                <li key={entry.id} className={summary.error ? 'wire-row error-step' : 'wire-row'}>
                  <span className="wire-time">{clock(entry.at)}</span>
                  <span className={`wire-kind ${entry.kind}`}>{entry.kind}</span>
                  <span className="wire-label">{summary.label}</span>
                  <span className="wire-meta">{summary.meta}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </aside>
  );
}
