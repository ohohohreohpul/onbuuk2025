import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Globe, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../lib/tenantContext';
import { adminAccessToken } from '../../../lib/functionAuth';
import { useAdminText } from '../../../lib/adminLanguage';
import type { Translations } from '../../../lib/bookingLanguage';
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_SURFACE } from '../adminUi';
import { useBilling } from '../billing/useBilling';

interface DomainRow { id: string; domain: string; status: string; is_primary: boolean | null }
interface DnsRecord { type: string; name: string; value: string }

type Keys = 'title' | 'hint' | 'paidOnly' | 'placeholder' | 'add' | 'adding' | 'check' | 'remove' | 'confirmRemove' | 'live'
  | 'waiting' | 'setRecords' | 'type' | 'name' | 'value' | 'dnsHint' | 'notYet' | 'failed' | 'primary';

const TEXT: Translations<Record<Keys, string>> = {
  en: {
    title: 'Your own domain', hint: 'Show your booking page on your own address, for example booking.my-spa.de. The secure https certificate is set up for you.',
    paidOnly: 'Your own domain is part of the Zenno plan.', placeholder: 'booking.my-spa.de', add: 'Add domain', adding: 'Adding…', check: 'Check again',
    remove: 'Remove', confirmRemove: 'Remove {domain}? Your booking page stays available on its Zenno address.', live: 'Live', waiting: 'Waiting for DNS',
    setRecords: 'Set these records where you bought the domain (for example IONOS or Strato):', type: 'Type', name: 'Name', value: 'Value',
    dnsHint: 'Changes can take from a few minutes up to a few hours. Then tap "Check again".', notYet: 'Not connected yet. Please check the records and try again later.',
    failed: 'Something went wrong. Please try again.', primary: 'Main address',
  },
  de: {
    title: 'Eigene Domain', hint: 'Zeigen Sie Ihre Buchungsseite unter Ihrer eigenen Adresse, z. B. termin.mein-spa.de. Das sichere https-Zertifikat richten wir automatisch ein.',
    paidOnly: 'Eine eigene Domain ist Teil des Zenno-Tarifs.', placeholder: 'termin.mein-spa.de', add: 'Domain hinzufügen', adding: 'Wird hinzugefügt…', check: 'Erneut prüfen',
    remove: 'Entfernen', confirmRemove: '{domain} entfernen? Ihre Buchungsseite bleibt unter der Zenno-Adresse erreichbar.', live: 'Aktiv', waiting: 'Wartet auf DNS',
    setRecords: 'Tragen Sie diese Einträge dort ein, wo Sie die Domain gekauft haben (z. B. IONOS oder Strato):', type: 'Typ', name: 'Name', value: 'Wert',
    dnsHint: 'Änderungen brauchen ein paar Minuten bis einige Stunden. Danach auf „Erneut prüfen“ tippen.', notYet: 'Noch nicht verbunden. Bitte Einträge prüfen und später erneut versuchen.',
    failed: 'Etwas ist schiefgelaufen. Bitte erneut versuchen.', primary: 'Hauptadresse',
  },
  th: {
    title: 'โดเมนของร้านเอง', hint: 'แสดงหน้าจองบนที่อยู่ของร้านเอง เช่น booking.my-spa.de ระบบจะตั้งค่าใบรับรอง https ให้อัตโนมัติ',
    paidOnly: 'โดเมนของร้านเองเป็นส่วนหนึ่งของแพ็กเกจ Zenno', placeholder: 'booking.my-spa.de', add: 'เพิ่มโดเมน', adding: 'กำลังเพิ่ม…', check: 'ตรวจสอบอีกครั้ง',
    remove: 'ลบ', confirmRemove: 'ลบ {domain}? หน้าจองยังใช้งานได้ที่ที่อยู่ของ Zenno', live: 'ใช้งานอยู่', waiting: 'รอการตั้งค่า DNS',
    setRecords: 'ตั้งค่ารายการเหล่านี้ที่ผู้ให้บริการโดเมน (เช่น IONOS หรือ Strato):', type: 'ประเภท', name: 'ชื่อ', value: 'ค่า',
    dnsHint: 'การเปลี่ยนแปลงอาจใช้เวลาไม่กี่นาทีถึงหลายชั่วโมง จากนั้นกด "ตรวจสอบอีกครั้ง"', notYet: 'ยังไม่เชื่อมต่อ กรุณาตรวจสอบรายการแล้วลองใหม่ภายหลัง',
    failed: 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง', primary: 'ที่อยู่หลัก',
  },
};

async function callDomain(action: 'add' | 'check' | 'remove', domain: string) {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/custom-domain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await adminAccessToken()}` },
    body: JSON.stringify({ action, domain }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data as { isVerified?: boolean; records?: DnsRecord[] };
}

/** Settings > Domain: connect the shop's own domain (Vercel), on paid plans. */
export default function CustomDomainSettings() {
  const { t } = useAdminText(TEXT);
  const { businessId } = useTenant();
  const { overview } = useBilling();
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [records, setRecords] = useState<Record<string, DnsRecord[]>>({});
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!businessId) return;
    const { data, error } = await supabase.from('custom_domains').select('id, domain, status, is_primary').eq('business_id', businessId).order('created_at');
    if (error) console.error('Could not load domains:', error);
    else setDomains(data ?? []);
  }, [businessId]);
  useEffect(() => { load(); }, [load]);

  const run = async (key: string, action: 'add' | 'check' | 'remove', domain: string) => {
    setBusy(key);
    setMessage(null);
    try {
      const result = await callDomain(action, domain);
      if (result.records) setRecords((r) => ({ ...r, [domain]: result.records! }));
      if (action === 'add') setInput('');
      if (action === 'check' && !result.isVerified) setMessage({ kind: 'info', text: t.notYet });
      await load();
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : t.failed });
    } finally {
      setBusy(null);
    }
  };

  const isPaid = overview ? overview.plan !== 'free' : true;
  return (
    <div className="space-y-4">
      <header>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-[#1A1714]"><Globe className="h-5 w-5" />{t.title}</h3>
        <p className="text-sm text-stone-500">{t.hint}</p>
      </header>
      {!isPaid && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{t.paidOnly}</p>}

      {isPaid && (
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (input.trim()) run('new', 'add', input.trim()); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t.placeholder} className={`${ADMIN_INPUT} max-w-sm flex-1`} />
          <button type="submit" disabled={busy !== null || !input.trim()} className={ADMIN_PRIMARY_BUTTON}>
            {busy === 'new' && <Loader2 className="h-4 w-4 animate-spin" />}{busy === 'new' ? t.adding : t.add}
          </button>
        </form>
      )}
      {message && <p role="status" className={`rounded-xl px-4 py-3 text-sm ${message.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-stone-100 text-stone-700'}`}>{message.text}</p>}

      {domains.map((d) => {
        const isLive = d.status === 'verified';
        const dns = records[d.domain];
        return (
          <section key={d.id} className={`${ADMIN_SURFACE} space-y-3 p-5`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#1A1714]">{d.domain}</p>
                <p className={`flex items-center gap-1 text-xs ${isLive ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {isLive && <CheckCircle2 className="h-3.5 w-3.5" />}{isLive ? t.live : t.waiting}{isLive && d.is_primary ? ` · ${t.primary}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                {!isLive && isPaid && (
                  <button type="button" disabled={busy !== null} onClick={() => run(d.id, 'check', d.domain)} className={`${ADMIN_SECONDARY_BUTTON} py-1.5`}>
                    {busy === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{t.check}
                  </button>
                )}
                <button type="button" disabled={busy !== null}
                  onClick={() => { if (window.confirm(t.confirmRemove.replace('{domain}', d.domain))) run(d.id, 'remove', d.domain); }}
                  className="rounded-lg p-2 text-stone-400 hover:bg-stone-900/[0.05] hover:text-red-600" aria-label={t.remove}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {!isLive && dns && (
              <div className="space-y-2">
                <p className="text-sm text-stone-600">{t.setRecords}</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs uppercase tracking-wider text-stone-500"><th className="py-1 pr-4">{t.type}</th><th className="py-1 pr-4">{t.name}</th><th className="py-1">{t.value}</th></tr></thead>
                    <tbody>
                      {dns.map((r) => (
                        <tr key={`${r.type}-${r.name}-${r.value}`} className="border-t border-stone-200/70 font-mono text-[13px]">
                          <td className="py-1.5 pr-4">{r.type}</td><td className="select-all py-1.5 pr-4">{r.name}</td><td className="select-all break-all py-1.5">{r.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-stone-400">{t.dnsHint}</p>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
