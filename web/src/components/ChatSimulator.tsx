import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ApiError, api } from '../api/client.ts';
import { streamReplies } from '../api/reply-stream.ts';
import type { Channel, Customer, Message, ReplyEvent, Session } from '../api/types.ts';

interface ChatSimulatorProps {
  session: Session;
}

type ConnectionState = 'connecting' | 'live' | 'reconnecting';

const RECONNECT_DELAY_MS = 2_000;
const TYPING_WINDOW_MS = 3 * 60_000;
const CLOCK_TICK_MS = 15_000;

function waitOrAbort(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatSimulator({ session }: ChatSimulatorProps) {
  const [customer, setCustomer] = useState<Customer>({
    id: '5511999999999',
    name: 'Maria Silva',
    channel: 'whatsapp',
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState<Record<string, string>>({});
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const reload = useCallback(async () => {
    try {
      setMessages(await api.listMessages(session));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load messages');
    }
  }, [session]);

  useEffect(() => {
    const controller = new AbortController();

    const handleEvent = (event: ReplyEvent) => {
      setStreaming((current) => ({
        ...current,
        [event.replyToId]:
          event.type === 'done' ? event.text : (current[event.replyToId] ?? '') + event.text,
      }));
      if (event.type === 'done') {
        void reload();
      }
    };

    const run = async () => {
      while (!controller.signal.aborted) {
        try {
          const events = streamReplies(session, controller.signal, () => {
            setConnection('live');
            void reload();
          });
          for await (const event of events) {
            handleEvent(event);
          }
        } catch {
          if (controller.signal.aborted) return;
        }
        setConnection('reconnecting');
        await waitOrAbort(RECONNECT_DELAY_MS, controller.signal);
      }
    };

    void run();
    return () => controller.abort();
  }, [session, reload]);

  const conversation = useMemo(
    () =>
      messages.filter(
        (message) => message.from.id === customer.id && message.channel === customer.channel,
      ),
    [messages, customer.id, customer.channel],
  );

  const contacts = useMemo(() => {
    const unique = new Map<string, Customer>();
    for (const message of messages) {
      const key = `${message.channel}:${message.from.id}`;
      if (!unique.has(key)) {
        unique.set(key, {
          id: message.from.id,
          name: message.from.name ?? '',
          channel: message.channel,
        });
      }
    }
    return [...unique.values()];
  }, [messages]);

  const answered = useMemo(
    () =>
      new Set(conversation.flatMap((message) => (message.replyToId ? [message.replyToId] : []))),
    [conversation],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.length, streaming]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setSending(true);
    setError(null);
    try {
      await api.sendCustomerMessage(session.tenantId, customer, text);
      setDraft('');
      await reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not send the message');
    } finally {
      setSending(false);
    }
  }

  function renderPendingReply(message: Message) {
    if (message.direction !== 'inbound' || answered.has(message.id)) return null;

    const partial = streaming[message.id];
    if (partial !== undefined) {
      return (
        <div className="bubble bot streaming" key={`${message.id}-reply`}>
          {partial}
          <span className="cursor" />
        </div>
      );
    }

    if (now - new Date(message.receivedAt).getTime() < TYPING_WINDOW_MS) {
      return (
        <div className="bubble bot typing" key={`${message.id}-typing`}>
          <span />
          <span />
          <span />
        </div>
      );
    }

    return null;
  }

  return (
    <section className="chat">
      <aside className="customer card">
        <h2>Customer</h2>
        <p className="hint">You are chatting as this customer, through the simulated provider.</p>
        <label>
          Phone / handle
          <input
            value={customer.id}
            onChange={(event) => setCustomer({ ...customer, id: event.target.value })}
          />
        </label>
        <label>
          Name
          <input
            value={customer.name}
            onChange={(event) => setCustomer({ ...customer, name: event.target.value })}
          />
        </label>
        <label>
          Channel
          <select
            value={customer.channel}
            onChange={(event) =>
              setCustomer({ ...customer, channel: event.target.value as Channel })
            }
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
          </select>
        </label>

        {contacts.length > 0 && (
          <>
            <h3>Existing conversations</h3>
            <ul className="contacts">
              {contacts.map((contact) => (
                <li key={`${contact.channel}:${contact.id}`}>
                  <button
                    type="button"
                    className={
                      contact.id === customer.id && contact.channel === customer.channel
                        ? 'contact active'
                        : 'contact'
                    }
                    onClick={() => setCustomer(contact)}
                  >
                    <strong>{contact.name || contact.id}</strong>
                    <span>
                      {contact.channel} · {contact.id}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>

      <div className="phone">
        <header className="phone-header">
          <div>
            <strong>{customer.name || customer.id}</strong>
            <span className="hint">{customer.channel}</span>
          </div>
          <span className={`status ${connection}`}>{connection}</span>
        </header>

        <div className="messages">
          {conversation.length === 0 && (
            <p className="empty">No messages yet. Say hi to the store!</p>
          )}
          {conversation.map((message) => [
            <div
              key={message.id}
              className={message.direction === 'inbound' ? 'bubble me' : 'bubble bot'}
            >
              {message.text}
              <time>{formatTime(message.receivedAt)}</time>
            </div>,
            renderPendingReply(message),
          ])}
          <div ref={bottomRef} />
        </div>

        {error && <p className="error banner">{error}</p>}

        <form className="composer" onSubmit={(event) => void handleSend(event)}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type a message"
            disabled={sending}
          />
          <button type="submit" disabled={sending || !draft.trim() || !customer.id.trim()}>
            Send
          </button>
        </form>
      </div>
    </section>
  );
}
