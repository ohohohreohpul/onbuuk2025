import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAdminText } from '../../../lib/adminLanguage';
import type { Translations } from '../../../lib/bookingLanguage';
import { renderMarketingEmail, type MarketingBlock, type MarketingShop, type MarketingVoucher } from '../../../../supabase/functions/_shared/marketingEmail';
import { loadMarketingShop, loadShopVouchers } from '../../../../supabase/functions/_shared/marketingData';

const TEXT: Translations<{ title: string; phone: string; desktop: string; loading: string; failed: string; sampleName: string }> = {
  en: { title: 'Preview', phone: 'Phone', desktop: 'Desktop', loading: 'Loading preview…', failed: 'Preview could not be loaded.', sampleName: 'Anna' },
  de: { title: 'Vorschau', phone: 'Handy', desktop: 'Desktop', loading: 'Vorschau wird geladen…', failed: 'Vorschau konnte nicht geladen werden.', sampleName: 'Anna' },
  th: { title: 'ตัวอย่าง', phone: 'มือถือ', desktop: 'เดสก์ท็อป', loading: 'กำลังโหลดตัวอย่าง…', failed: 'โหลดตัวอย่างไม่สำเร็จ', sampleName: 'Anna' },
};

const PHONE_WIDTH = 390;
const DESKTOP_WIDTH = 640;
const PREVIEW_HEIGHT = 760;

interface EmailPreviewProps {
  businessId: string;
  subject: string;
  blocks: MarketingBlock[];
}

/** Renders exactly what customers receive, with the shop's real voucher cards and a sample first name. */
export default function EmailPreview({ businessId, subject, blocks }: EmailPreviewProps) {
  const { t } = useAdminText(TEXT);
  const [shop, setShop] = useState<MarketingShop | null>(null);
  const [vouchers, setVouchers] = useState<MarketingVoucher[]>([]);
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(PHONE_WIDTH);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadMarketingShop(supabase, businessId);
        const cards = await loadShopVouchers(supabase, businessId, loaded);
        if (!cancelled) { setShop(loaded); setVouchers(cards); }
      } catch (error) {
        console.error('Could not load email preview data:', error);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [businessId]);

  const html = useMemo(
    () => (shop ? renderMarketingEmail(shop, { subject, blocks }, t.sampleName, '#', vouchers).html : ''),
    [shop, subject, blocks, vouchers, t.sampleName],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[#1A1714]">{t.title}</span>
        <span className="flex gap-1 rounded-lg bg-stone-900/[0.04] p-0.5" role="radiogroup" aria-label={t.title}>
          {([[PHONE_WIDTH, t.phone], [DESKTOP_WIDTH, t.desktop]] as const).map(([value, label]) => (
            <button key={value} type="button" role="radio" aria-checked={width === value} onClick={() => setWidth(value)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${width === value ? 'bg-white text-[#1A1714] shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>
              {label}
            </button>
          ))}
        </span>
      </div>
      <div className="overflow-auto rounded-2xl bg-[#EFEBE6] ring-1 ring-stone-200/80">
        {failed ? (
          <p className="p-6 text-sm text-red-700">{t.failed}</p>
        ) : !shop ? (
          <p className="p-6 text-sm text-stone-500">{t.loading}</p>
        ) : (
          <iframe title={t.title} srcDoc={html} sandbox="" style={{ width, height: PREVIEW_HEIGHT }} className="mx-auto block max-w-full border-0" />
        )}
      </div>
    </div>
  );
}
