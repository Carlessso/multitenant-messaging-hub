import { useState, type FormEvent } from 'react';
import { ApiError, api } from '../api/client.ts';
import type { CreatedTenant, Session } from '../api/types.ts';
import { DEMO_TENANTS, type DemoTenant } from '../demo.ts';

interface TenantGateProps {
  onSession: (session: Session) => void;
}

const BOT_INSTRUCTIONS_MAX_LENGTH = 2000;

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? `${error.code}: ${error.message}` : 'Unexpected error';
}

export function TenantGate({ onSession }: TenantGateProps) {
  const [demoError, setDemoError] = useState<string | null>(null);
  const [openingDemo, setOpeningDemo] = useState<string | null>(null);

  const [tenantId, setTenantId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [openError, setOpenError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const [adminApiKey, setAdminApiKey] = useState('');
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newInstructions, setNewInstructions] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedTenant | null>(null);
  const [copied, setCopied] = useState(false);

  async function openDemo(tenant: DemoTenant) {
    setOpeningDemo(tenant.id);
    setDemoError(null);
    const session = { tenantId: tenant.id, apiKey: tenant.apiKey };
    try {
      await api.getSettings(session);
      onSession(session);
    } catch (error) {
      setDemoError(
        error instanceof ApiError && error.status === 401
          ? `${tenant.name} was not found. Run the seed (npm run db:seed) or restart with docker compose up.`
          : errorMessage(error),
      );
    } finally {
      setOpeningDemo(null);
    }
  }

  async function handleOpen(event: FormEvent) {
    event.preventDefault();
    setOpening(true);
    setOpenError(null);
    const session = { tenantId: tenantId.trim(), apiKey: apiKey.trim() };
    try {
      await api.getSettings(session);
      onSession(session);
    } catch (error) {
      setOpenError(errorMessage(error));
    } finally {
      setOpening(false);
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const tenant = await api.createTenant(adminApiKey.trim(), {
        id: newId.trim(),
        name: newName.trim(),
        botInstructions: newInstructions.trim() || null,
      });
      setCreated(tenant);
    } catch (error) {
      setCreateError(errorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  async function copyApiKey() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.apiKey);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (created) {
    return (
      <main className="gate">
        <section className="card">
          <h2>Tenant created</h2>
          <p>
            <strong>{created.name}</strong> (<code>{created.id}</code>) is ready. This is its API
            key. It is shown <strong>only once</strong>, so store it now.
          </p>
          <div className="key-box">
            <code>{created.apiKey}</code>
            <button type="button" className="secondary" onClick={() => void copyApiKey()}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => onSession({ tenantId: created.id, apiKey: created.apiKey })}
          >
            Open {created.name}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="gate">
      <section className="card demo">
        <h2>Pick a demo store</h2>
        <p className="hint">
          You will chat as a customer of the store and see its assistant reply in real time.
        </p>
        <div className="demo-tenants">
          {DEMO_TENANTS.map((tenant) => (
            <button
              key={tenant.id}
              type="button"
              className="demo-tenant"
              disabled={openingDemo !== null}
              onClick={() => void openDemo(tenant)}
            >
              <strong>{tenant.name}</strong>
              <span>{openingDemo === tenant.id ? 'Opening…' : tenant.description}</span>
            </button>
          ))}
        </div>
        {demoError && <p className="error">{demoError}</p>}
      </section>

      <details className="advanced">
        <summary>Use your own tenant</summary>
        <div className="advanced-grid">
          <section className="card">
            <h2>Open a tenant</h2>
            <form onSubmit={(event) => void handleOpen(event)}>
              <label>
                Tenant id
                <input
                  value={tenantId}
                  onChange={(event) => setTenantId(event.target.value)}
                  required
                />
              </label>
              <label>
                API key
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="hub_..."
                  required
                />
              </label>
              {openError && <p className="error">{openError}</p>}
              <button type="submit" disabled={opening}>
                {opening ? 'Checking…' : 'Open'}
              </button>
            </form>
          </section>

          <section className="card">
            <h2>Create a tenant</h2>
            <p className="hint">
              Requires the <code>ADMIN_API_KEY</code> from the API&apos;s <code>.env</code>.
            </p>
            <form onSubmit={(event) => void handleCreate(event)}>
              <label>
                Admin API key
                <input
                  type="password"
                  value={adminApiKey}
                  onChange={(event) => setAdminApiKey(event.target.value)}
                  required
                />
              </label>
              <label>
                Tenant id
                <input
                  value={newId}
                  onChange={(event) => setNewId(event.target.value)}
                  placeholder="sorveteria-ana"
                  pattern="[a-z0-9-]+"
                  title="Lowercase letters, numbers and hyphens"
                  required
                />
              </label>
              <label>
                Store name
                <input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Sorveteria da Ana"
                  required
                />
              </label>
              <label>
                Bot instructions (optional)
                <textarea
                  rows={4}
                  maxLength={BOT_INSTRUCTIONS_MAX_LENGTH}
                  value={newInstructions}
                  onChange={(event) => setNewInstructions(event.target.value)}
                  placeholder="You are the assistant of Sorveteria da Ana. Answer cordially and always mention our new mango flavor."
                />
              </label>
              {createError && <p className="error">{createError}</p>}
              <button type="submit" disabled={creating}>
                {creating ? 'Creating…' : 'Create tenant'}
              </button>
            </form>
          </section>
        </div>
      </details>
    </main>
  );
}
