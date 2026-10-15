import { useState } from 'react';
import { Copy, Check, Plus, Ban } from 'lucide-react';
import {
  ADMIN_INPUT,
  ADMIN_SECONDARY_BUTTON,
  ADMIN_TERTIARY_BUTTON,
  ADMIN_STATUS_PILL,
} from '../adminUi';
import { createAgentKey, revokeAgentKey, type AgentKeyRow } from '../../../lib/agentAdminApi';
import { useAdminText } from '../../../lib/adminLanguage';
import type { Translations } from '../../../lib/bookingLanguage';

const TEXT: Translations<{
  title: string; intro: string; defaultLabel: string; createFailed: string; revokeFailed: string; copyNow: string;
  copied: string; copy: string; done: string; namePlaceholder: string; createKey: string; off: string; turnOff: string;
}> = {
  en: {
    title: 'Connection keys', intro: 'Only needed if a developer connects a custom assistant to your business.',
    defaultLabel: 'Connection key', createFailed: 'Could not create the key', revokeFailed: 'Could not turn off the key',
    copyNow: 'Copy this key now. It is shown only once.', copied: 'Copied', copy: 'Copy', done: 'Done',
    namePlaceholder: 'Name (e.g. Website chatbot)', createKey: 'Create key', off: 'off', turnOff: 'Turn off',
  },
  de: {
    title: 'Verbindungsschlüssel', intro: 'Nur nötig, wenn ein Entwickler einen eigenen Assistenten mit Ihrem Betrieb verbindet.',
    defaultLabel: 'Verbindungsschlüssel', createFailed: 'Schlüssel konnte nicht erstellt werden', revokeFailed: 'Schlüssel konnte nicht deaktiviert werden',
    copyNow: 'Kopieren Sie diesen Schlüssel jetzt. Er wird nur einmal angezeigt.', copied: 'Kopiert', copy: 'Kopieren', done: 'Fertig',
    namePlaceholder: 'Name (z. B. Website-Chatbot)', createKey: 'Schlüssel erstellen', off: 'aus', turnOff: 'Deaktivieren',
  },
  th: {
    title: 'คีย์เชื่อมต่อ', intro: 'ใช้เฉพาะเมื่อนักพัฒนาเชื่อมผู้ช่วยแบบกำหนดเองเข้ากับธุรกิจของคุณ',
    defaultLabel: 'คีย์เชื่อมต่อ', createFailed: 'สร้างคีย์ไม่สำเร็จ', revokeFailed: 'ปิดคีย์ไม่สำเร็จ',
    copyNow: 'คัดลอกคีย์นี้ตอนนี้ คีย์จะแสดงเพียงครั้งเดียว', copied: 'คัดลอกแล้ว', copy: 'คัดลอก', done: 'เสร็จสิ้น',
    namePlaceholder: 'ชื่อ (เช่น แชตบอตบนเว็บไซต์)', createKey: 'สร้างคีย์', off: 'ปิดอยู่', turnOff: 'ปิดใช้งาน',
  },
};

interface AgentKeysPanelProps {
  keys: AgentKeyRow[];
  onKeysChange: (keys: AgentKeyRow[]) => void;
  onError: (message: string) => void;
}

// Advanced: connection keys for custom integrations. Most merchants never need this.
export default function AgentKeysPanel({ keys, onKeysChange, onError }: AgentKeysPanelProps) {
  const { t } = useAdminText(TEXT);
  const [label, setLabel] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    try {
      const { key, record } = await createAgentKey(label.trim() || t.defaultLabel);
      setCreatedKey(key);
      setCopied(false);
      setLabel('');
      onKeysChange([record, ...keys]);
    } catch (err) {
      onError(err instanceof Error ? err.message : t.createFailed);
    }
  };

  const handleRevoke = async (keyId: string) => {
    try {
      await revokeAgentKey(keyId);
      const revokedAt = new Date().toISOString();
      onKeysChange(keys.map((k) => (k.id === keyId ? { ...k, revoked_at: revokedAt } : k)));
    } catch (err) {
      onError(err instanceof Error ? err.message : t.revokeFailed);
    }
  };

  const copyKey = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-[#1A1714]">{t.title}</h3>
      <p className="mt-0.5 text-sm text-stone-500">
        {t.intro}
      </p>

      {createdKey && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">{t.copyNow}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-white px-3 py-2 font-mono text-xs text-stone-800">
              {createdKey}
            </code>
            <button type="button" className={ADMIN_TERTIARY_BUTTON} onClick={copyKey}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t.copied : t.copy}
            </button>
            <button type="button" className={ADMIN_TERTIARY_BUTTON} onClick={() => setCreatedKey(null)}>
              {t.done}
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          className={ADMIN_INPUT}
          placeholder={t.namePlaceholder}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button type="button" className={ADMIN_SECONDARY_BUTTON} onClick={handleCreate}>
          <Plus className="h-4 w-4" /> {t.createKey}
        </button>
      </div>

      {keys.length > 0 && (
        <ul className="mt-3 divide-y divide-stone-100">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium text-[#1A1714]">{k.label ?? t.defaultLabel}</div>
                <div className="font-mono text-xs text-stone-400">{k.key_prefix}…</div>
              </div>
              {k.revoked_at ? (
                <span className={`${ADMIN_STATUS_PILL} bg-stone-100 text-stone-500`}>{t.off}</span>
              ) : (
                <button type="button" className={ADMIN_TERTIARY_BUTTON} onClick={() => handleRevoke(k.id)}>
                  <Ban className="h-4 w-4" /> {t.turnOff}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
