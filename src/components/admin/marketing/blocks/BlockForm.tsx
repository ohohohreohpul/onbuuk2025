import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { useAdminText } from '../../../../lib/adminLanguage';
import type { ImageSize, MarketingBlock } from '../../../../../supabase/functions/_shared/marketingEmail';
import { ADMIN_INPUT, ADMIN_SECONDARY_BUTTON, ADMIN_TERTIARY_BUTTON } from '../../adminUi';
import AssetPicker from '../assets/AssetPicker';
import { BLOCK_TEXT } from './blockText';

interface BlockFormProps<T extends MarketingBlock = MarketingBlock> {
  block: T;
  businessId: string;
  onChange: (block: T) => void;
}

const centsToEuro = (cents: number | null | undefined) => (cents == null ? '' : String(cents / 100).replace('.', ','));
const euroToCents = (value: string): number | null => {
  const parsed = parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-stone-400">{hint}</span>}
    </label>
  );
}

function ImageField({ label, value, businessId, onChange }: { label: string; value: string | null | undefined; businessId: string; onChange: (url: string | null) => void }) {
  const { t } = useAdminText(BLOCK_TEXT);
  const [picking, setPicking] = useState(false);
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-stone-600">{label}</span>
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt="" className="h-14 w-14 rounded-lg bg-stone-100 object-contain ring-1 ring-stone-200" />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-stone-100 text-stone-400 ring-1 ring-stone-200"><ImageIcon className="h-5 w-5" /></span>
        )}
        <button type="button" onClick={() => setPicking(true)} className={ADMIN_SECONDARY_BUTTON}>{value ? t.changeImage : t.chooseImage}</button>
        {value && <button type="button" onClick={() => onChange(null)} className={ADMIN_TERTIARY_BUTTON}>{t.removeImage}</button>}
      </div>
      {picking && <AssetPicker businessId={businessId} onClose={() => setPicking(false)} onPick={(url) => { onChange(url); setPicking(false); }} />}
    </div>
  );
}

/** The fields of one block; every change returns a new block object. */
export default function BlockForm({ block, businessId, onChange }: BlockFormProps) {
  const { t } = useAdminText(BLOCK_TEXT);
  const set = (patch: Partial<MarketingBlock>) => onChange({ ...block, ...patch } as MarketingBlock);

  switch (block.type) {
    case 'hero':
      return (
        <div className="space-y-3">
          <ImageField label={t.logo} value={block.logoUrl} businessId={businessId} onChange={(logoUrl) => set({ logoUrl })} />
          <Field label={t.headline} hint={t.headlineHint}>
            <textarea value={block.headline ?? ''} onChange={(e) => set({ headline: e.target.value })} rows={2} maxLength={160} className={ADMIN_INPUT} />
          </Field>
          <ImageField label={`${t.photo} (${t.optional})`} value={block.imageUrl} businessId={businessId} onChange={(imageUrl) => set({ imageUrl })} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={t.buttonText}><input value={block.buttonText ?? ''} onChange={(e) => set({ buttonText: e.target.value })} maxLength={60} className={ADMIN_INPUT} /></Field>
            <Field label={t.buttonUrl}><input value={block.buttonUrl ?? ''} onChange={(e) => set({ buttonUrl: e.target.value.trim() })} inputMode="url" className={ADMIN_INPUT} /></Field>
          </div>
          <Field label={`${t.caption} (${t.optional})`}><input value={block.caption ?? ''} onChange={(e) => set({ caption: e.target.value })} maxLength={120} className={ADMIN_INPUT} /></Field>
        </div>
      );
    case 'heading':
      return (
        <Field label={t.heading} hint={t.headlineHint}>
          <textarea value={block.text} onChange={(e) => set({ text: e.target.value })} rows={2} maxLength={160} className={ADMIN_INPUT} />
        </Field>
      );
    case 'text':
      return (
        <Field label={t.body} hint={t.bodyHint}>
          <textarea value={block.text} onChange={(e) => set({ text: e.target.value })} rows={5} maxLength={5000} className={`${ADMIN_INPUT} leading-relaxed`} />
        </Field>
      );
    case 'image':
      return (
        <div className="space-y-3">
          <ImageField label={t.image} value={block.url || null} businessId={businessId} onChange={(url) => set({ url: url ?? '' })} />
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t.size}>
            {(['small', 'medium', 'full'] as ImageSize[]).map((size) => (
              <button key={size} type="button" role="radio" aria-checked={(block.size ?? 'medium') === size} onClick={() => set({ size })}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition ${(block.size ?? 'medium') === size ? 'bg-[#1A1714] text-white ring-transparent' : 'bg-white text-stone-600 ring-stone-200 hover:bg-stone-50'}`}>
                {t[size]}
              </button>
            ))}
          </div>
          <Field label={t.link}><input value={block.link ?? ''} onChange={(e) => set({ link: e.target.value.trim() || null })} inputMode="url" placeholder="https://" className={ADMIN_INPUT} /></Field>
        </div>
      );
    case 'button':
      return (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={t.buttonText}><input value={block.text} onChange={(e) => set({ text: e.target.value })} maxLength={60} className={ADMIN_INPUT} /></Field>
            <Field label={t.buttonUrl}><input value={block.url} onChange={(e) => set({ url: e.target.value.trim() })} inputMode="url" className={ADMIN_INPUT} /></Field>
          </div>
          <div className="flex gap-1.5" role="radiogroup" aria-label={t.style}>
            {(['dark', 'light'] as const).map((style) => (
              <button key={style} type="button" role="radio" aria-checked={(block.style ?? 'dark') === style} onClick={() => set({ style })}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition ${(block.style ?? 'dark') === style ? 'bg-[#1A1714] text-white ring-transparent' : 'bg-white text-stone-600 ring-stone-200 hover:bg-stone-50'}`}>
                {t[style]}
              </button>
            ))}
          </div>
        </div>
      );
    case 'offer':
      return (
        <div className="space-y-3">
          <Field label={t.title} hint={t.headlineHint}><textarea value={block.title} onChange={(e) => set({ title: e.target.value })} rows={2} maxLength={160} className={ADMIN_INPUT} /></Field>
          <Field label={`${t.body} (${t.optional})`}><textarea value={block.text ?? ''} onChange={(e) => set({ text: e.target.value })} rows={3} maxLength={2000} className={ADMIN_INPUT} /></Field>
          <ImageField label={`${t.image} (${t.optional})`} value={block.imageUrl} businessId={businessId} onChange={(imageUrl) => set({ imageUrl })} />
          <div className="grid grid-cols-2 gap-2">
            <Field label={t.price}><input defaultValue={centsToEuro(block.priceCents)} onChange={(e) => set({ priceCents: euroToCents(e.target.value) })} inputMode="decimal" className={ADMIN_INPUT} /></Field>
            <Field label={t.comparePrice}><input defaultValue={centsToEuro(block.compareCents)} onChange={(e) => set({ compareCents: euroToCents(e.target.value) })} inputMode="decimal" className={ADMIN_INPUT} /></Field>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={t.buttonText}><input value={block.buttonText ?? ''} onChange={(e) => set({ buttonText: e.target.value })} maxLength={60} className={ADMIN_INPUT} /></Field>
            <Field label={t.buttonUrl}><input value={block.buttonUrl ?? ''} onChange={(e) => set({ buttonUrl: e.target.value.trim() })} inputMode="url" className={ADMIN_INPUT} /></Field>
          </div>
        </div>
      );
    case 'vouchers':
      return (
        <div className="space-y-3">
          <p className="text-xs text-stone-500">{t.vouchersAuto}</p>
          <Field label={t.vouchersTitle} hint={t.headlineHint}><textarea value={block.title ?? ''} onChange={(e) => set({ title: e.target.value })} rows={2} maxLength={160} className={ADMIN_INPUT} /></Field>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={block.showImages === true} onChange={(e) => set({ showImages: e.target.checked })} className="h-4 w-4 accent-[#1A1714]" />
            {t.showImages}
          </label>
        </div>
      );
    default:
      return null;
  }
}
