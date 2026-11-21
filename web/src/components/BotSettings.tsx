import { useState, type FormEvent } from 'react';
import { ApiError, api } from '../api/client.ts';
import type { Session, TenantProfile } from '../api/types.ts';

interface BotSettingsProps {
  session: Session;
  profile: TenantProfile;
  onSaved: (profile: TenantProfile) => void;
}

const MAX_LENGTH = 2000;

export function BotSettings({ session, profile, onSaved }: BotSettingsProps) {
  const [instructions, setInstructions] = useState(profile.botInstructions ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const dirty = instructions.trim() !== (profile.botInstructions ?? '');

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setError(null);
    try {
      const updated = await api.updateSettings(session, instructions.trim() || null);
      setInstructions(updated.botInstructions ?? '');
      onSaved(updated);
      setStatus('saved');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unexpected error');
      setStatus('error');
    }
  }

  return (
    <section className="card settings">
      <h2>Bot instructions</h2>
      <p className="hint">
        Tell the assistant of <strong>{profile.name}</strong> who it is and how to answer. Changes
        apply to the next customer message. The assistant always answers in the customer&apos;s
        language and never makes up prices or opening hours you did not write here.
      </p>
      <form onSubmit={(event) => void handleSave(event)}>
        <textarea
          rows={10}
          maxLength={MAX_LENGTH}
          value={instructions}
          onChange={(event) => {
            setInstructions(event.target.value);
            setStatus('idle');
          }}
          placeholder={`You are the assistant of ${profile.name}. Answer cordially. We open Monday to Saturday, 9am to 6pm, and deliver within 5 km.`}
        />
        <div className="settings-footer">
          <span className="hint">
            {instructions.length}/{MAX_LENGTH}
          </span>
          {status === 'saved' && <span className="ok">Saved</span>}
          {error && <span className="error">{error}</span>}
          <button type="submit" disabled={!dirty || status === 'saving'}>
            {status === 'saving' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </section>
  );
}
