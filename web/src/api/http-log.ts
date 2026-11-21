export interface HttpLogEntry {
  at: string;
  method: string;
  path: string;
  status: number | null;
  durationMs: number;
}

type HttpLogListener = (entry: HttpLogEntry) => void;

const listeners = new Set<HttpLogListener>();

export function onHttpLog(listener: HttpLogListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loggedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = init.method ?? 'GET';
  const at = new Date().toISOString();
  const startedAt = performance.now();
  const emit = (status: number | null) => {
    const entry = {
      at,
      method,
      path,
      status,
      durationMs: Math.round(performance.now() - startedAt),
    };
    for (const listener of listeners) {
      listener(entry);
    }
  };

  try {
    const response = await fetch(path, init);
    emit(response.status);
    return response;
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      emit(null);
    }
    throw error;
  }
}
