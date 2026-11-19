import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, FileText, Landmark, Loader2, MapPin, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../lib/tenantContext';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText } from '../../../lib/bookingLanguage';
import { ADMIN_SECONDARY_BUTTON } from '../adminUi';
import { INVOICE_GUIDE_TEXT } from './invoiceGuideText';
import { invoiceSetupStatus, type InvoiceSetupBusiness, type InvoiceSetupStatus } from './invoiceSetup';

/** Where a step's button takes the owner: an admin view, optionally a Settings tab. */
export interface GuideDestination {
  view: string;
  settingsTab?: string;
}

interface InvoiceSetupGuideProps {
  onClose: () => void;
  onNavigate: (destination: GuideDestination) => void;
}

const STEP_COUNT = 3;
const STEP_ICONS = [Landmark, MapPin, FileText];

function StatusRow({ label, value, isOk }: { label: string; value: string; isOk: boolean }) {
  return (
    <li className="flex items-start gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-stone-200/70">
      <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${isOk ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/70'}`}>
        {isOk ? <Check className="h-3 w-3" strokeWidth={2.5} /> : <AlertTriangle className="h-3 w-3" strokeWidth={2.5} />}
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-stone-500">{label}</span>
        <span className={`block break-words text-sm font-medium ${isOk ? 'text-[#1A1714]' : 'text-amber-800'}`}>{value}</span>
      </span>
    </li>
  );
}

/**
 * Three-step guide for E-Rechnung: checks the shop's tax details and address
 * (the parts the e-invoice needs) and shows how to issue the first invoice.
 */
export default function InvoiceSetupGuide({ onClose, onNavigate }: InvoiceSetupGuideProps) {
  const { businessId } = useTenant();
  const { t } = useAdminText(INVOICE_GUIDE_TEXT);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<InvoiceSetupStatus | null>(null);
  const [hasLoadFailed, setHasLoadFailed] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    let isCancelled = false;
    supabase
      .from('businesses')
      .select('name, legal_name, tax_number, vat_id, is_small_business, address, address_line, city')
      .eq('id', businessId)
      .maybeSingle<InvoiceSetupBusiness>()
      .then(({ data, error }) => {
        if (isCancelled) return;
        if (error || !data) {
          console.error('Could not load invoice setup status:', error);
          setHasLoadFailed(true);
          return;
        }
        setStatus(invoiceSetupStatus(data));
      });
    return () => { isCancelled = true; };
  }, [businessId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const go = (destination: GuideDestination) => {
    onClose();
    onNavigate(destination);
  };

  const isLast = step === STEP_COUNT - 1;
  const Icon = STEP_ICONS[step];
  const titles = [t.taxTitle, t.addressTitle, t.issueTitle];
  const bodies = [t.taxBody, t.addressBody, t.issueBody];

  const stepContent = (): ReactNode => {
    if (hasLoadFailed && step < 2) return <p role="alert" className="text-sm text-red-600">{t.loadFailed}</p>;
    if (!status && step < 2) {
      return <p className="flex items-center gap-2 text-sm text-stone-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t.loading}</p>;
    }
    if (step === 0 && status) {
      return (
        <>
          <ul className="space-y-2">
            <StatusRow label={t.taxId} value={status.taxId ?? t.taxIdMissing} isOk={Boolean(status.taxId)} />
            <StatusRow label={t.invoiceName} value={status.invoiceName ?? '—'} isOk={Boolean(status.invoiceName)} />
            <StatusRow label={t.smallBusiness} value={status.isSmallBusiness ? t.smallBusinessYes : t.smallBusinessNo} isOk />
          </ul>
          <button type="button" className={`${ADMIN_SECONDARY_BUTTON} mt-4`} onClick={() => go({ view: 'settings', settingsTab: 'invoices' })}>
            {t.openInvoiceSettings}
          </button>
        </>
      );
    }
    if (step === 1 && status) {
      const { address } = status;
      return (
        <>
          <ul className="space-y-2">
            <StatusRow label={t.street} value={address.street ?? t.notFound} isOk={Boolean(address.street)} />
            <StatusRow label={t.postcode} value={address.postcode ?? t.notFound} isOk={Boolean(address.postcode)} />
            <StatusRow label={t.city} value={address.city ?? t.notFound} isOk={Boolean(address.city)} />
          </ul>
          <p className={`mt-3 text-sm ${status.isAddressReadable ? 'text-emerald-700' : 'text-amber-800'}`}>
            {status.isAddressReadable ? t.addressOk : t.addressHint}
          </p>
          {!status.isAddressReadable && (
            <button type="button" className={`${ADMIN_SECONDARY_BUTTON} mt-4`} onClick={() => go({ view: 'settings', settingsTab: 'profile' })}>
              {t.openStoreProfile}
            </button>
          )}
        </>
      );
    }
    return (
      <>
        <ol className="space-y-2">
          {t.issueSteps.split('|').map((line, lineIndex) => (
            <li key={line} className="flex items-start gap-3 text-sm text-stone-700">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1A1714] text-xs font-semibold text-white">{lineIndex + 1}</span>
              <span className="pt-0.5">{line}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-xl bg-white px-4 py-3 text-xs text-stone-600 ring-1 ring-stone-200/70">{t.reprintNote}</p>
        <button type="button" className={`${ADMIN_SECONDARY_BUTTON} mt-4`} onClick={() => go({ view: 'bookings' })}>
          {t.openBookings}
        </button>
      </>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1A1714]/50 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="invoice-guide-title"
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-[#F7F5F2] shadow-[0_24px_80px_rgba(26,23,20,0.35)]">
        <button type="button" onClick={onClose} aria-label={t.close}
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-900/5 hover:text-stone-700">
          <X className="h-4 w-4" />
        </button>

        <div className="px-8 pb-2 pt-9">
          <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1A1714] text-white">
            <Icon className="h-6 w-6" strokeWidth={1.6} />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
            {t.title} · {fillText(t.stepOf, { current: step + 1, total: STEP_COUNT })}
          </p>
          <h2 id="invoice-guide-title" className="mt-2 text-[24px] font-semibold leading-tight tracking-tight text-[#1A1714]">{titles[step]}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-stone-600">{bodies[step]}</p>
        </div>

        <div className="px-8 pt-4">{stepContent()}</div>

        <div className="flex items-center justify-between gap-4 px-8 pb-7 pt-8">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {Array.from({ length: STEP_COUNT }, (_, dotIndex) => (
              <span key={dotIndex} className={`h-1.5 rounded-full transition-all duration-300 ${dotIndex === step ? 'w-6 bg-[#1A1714]' : 'w-1.5 bg-stone-300'}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep((current) => current - 1)}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-900/5 hover:text-[#1A1714]">
                <ArrowLeft className="h-4 w-4" /> {t.back}
              </button>
            )}
            <button type="button" onClick={() => (isLast ? onClose() : setStep((current) => current + 1))}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1A1714] px-4 py-2.5 text-sm font-medium text-white shadow-[0_2px_12px_rgba(26,23,20,0.18)] transition hover:bg-[#2E2926] active:translate-y-px">
              {isLast ? t.done : t.next}
              {!isLast && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
