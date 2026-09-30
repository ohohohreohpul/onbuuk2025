import { useState } from 'react';
import { Copy, Check, Plus, Ban } from 'lucide-react';
import {
  ADMIN_INPUT,
  ADMIN_SECONDARY_BUTTON,
  ADMIN_TERTIARY_BUTTON,
  ADMIN_STATUS_PILL,
} from '../adminUi';
import { createAgentKey, revokeAgentKey, type AgentKeyRow } from '../../../lib/agentAdminApi';

interface AgentKeysPanelProps {
  keys: AgentKeyRow[];
  onKeysChange: (keys: AgentKeyRow[]) => void;
  onError: (message: string) => void;
}

// Advanced: connection keys for custom integrations. Most merchants never need this.
export default function AgentKeysPanel({ keys, onKeysChange, onError }: AgentKeysPanelProps) {
  const [label, setLabel] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    try {
      const { key, record } = await createAgentKey(label.trim() || 'Connection key');
      setCreatedKey(key);
      setCopied(false);
      setLabel('');
      onKeysChange([record, ...keys]);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not create the key');
    }
  };

  const handleRevoke = async (keyId: string) => {
    try {
      await revokeAgentKey(keyId);
      const revokedAt = new Date().toISOString();
      onKeysChange(keys.map((k) => (k.id === keyId ? { ...k, revoked_at: revokedAt } : k)));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not turn off the key');
    }
  };

  const copyKey = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-[#1A1714]">Connection keys</h3>
      <p className="mt-0.5 text-sm text-stone-500">
        Only needed if a developer connects a custom assistant to your business.
      </p>

      {createdKey && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">Copy this key now. It is shown only once.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-white px-3 py-2 font-mono text-xs text-stone-800">
              {createdKey}
            </code>
            <button type="button" className={ADMIN_TERTIARY_BUTTON} onClick={copyKey}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" className={ADMIN_TERTIARY_BUTTON} onClick={() => setCreatedKey(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          className={ADMIN_INPUT}
          placeholder="Name (e.g. Website chatbot)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button type="button" className={ADMIN_SECONDARY_BUTTON} onClick={handleCreate}>
          <Plus className="h-4 w-4" /> Create key
        </button>
      </div>

      {keys.length > 0 && (
        <ul className="mt-3 divide-y divide-stone-100">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium text-[#1A1714]">{k.label ?? 'Connection key'}</div>
                <div className="font-mono text-xs text-stone-400">{k.key_prefix}…</div>
              </div>
              {k.revoked_at ? (
                <span className={`${ADMIN_STATUS_PILL} bg-stone-100 text-stone-500`}>off</span>
              ) : (
                <button type="button" className={ADMIN_TERTIARY_BUTTON} onClick={() => handleRevoke(k.id)}>
                  <Ban className="h-4 w-4" /> Turn off
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
