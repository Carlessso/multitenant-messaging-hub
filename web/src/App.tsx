import { useEffect, useState } from 'react';
import { ApiError, api } from './api/client.ts';
import type { Session, TenantProfile } from './api/types.ts';
import { BotSettings } from './components/BotSettings.tsx';
import { ChatSimulator } from './components/ChatSimulator.tsx';
import { TenantGate } from './components/TenantGate.tsx';
import { clearSession, loadSession, saveSession } from './session.ts';

type Tab = 'chat' | 'settings';

export default function App() {
  const [session, setSession] = useState<Session | null>(loadSession);
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [tab, setTab] = useState<Tab>('chat');

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    api.getSettings(session).then(
      (loaded) => {
        if (!cancelled) setProfile(loaded);
      },
      (error: unknown) => {
        if (
          !cancelled &&
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
        ) {
          clearSession();
          setSession(null);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [session]);

  function openSession(next: Session) {
    saveSession(next);
    setProfile(null);
    setTab('chat');
    setSession(next);
  }

  function signOut() {
    clearSession();
    setSession(null);
    setProfile(null);
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Messaging Hub</h1>
        {session && (
          <>
            <nav className="tabs">
              <button
                type="button"
                className={tab === 'chat' ? 'tab active' : 'tab'}
                onClick={() => setTab('chat')}
              >
                Chat
              </button>
              <button
                type="button"
                className={tab === 'settings' ? 'tab active' : 'tab'}
                onClick={() => setTab('settings')}
              >
                Bot settings
              </button>
            </nav>
            <div className="tenant">
              <span>
                {profile?.name ?? session.tenantId} <code>{session.tenantId}</code>
              </span>
              <button type="button" className="secondary" onClick={signOut}>
                Switch tenant
              </button>
            </div>
          </>
        )}
      </header>

      {!session && <TenantGate onSession={openSession} />}
      {session && tab === 'chat' && <ChatSimulator key={session.tenantId} session={session} />}
      {session && tab === 'settings' && profile && (
        <BotSettings session={session} profile={profile} onSaved={setProfile} />
      )}
    </div>
  );
}
