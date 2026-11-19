import { useEffect, useState } from 'react';
import { Building2, Check, Download, FileCheck2, Loader2, ReceiptEuro, User, X } from 'lucide-react';
import { findBookingInvoice, issueBookingInvoice, saveInvoicePdf } from '../../../lib/invoice/invoiceApi';
import { issueDate, type Invoice } from '../../../lib/invoice/invoiceText';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText } from '../../../lib/bookingLanguage';
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON } from '../adminUi';
import { EMPTY_INVOICE_FORM, SMALL_INVOICE_LIMIT_CENTS, invoiceFormProblem, invoiceRequest, type InvoiceForm } from './invoiceForm';
import { INVOICE_MODAL_TEXT } from './invoiceModalText';

interface InvoiceModalProps {
  booking: { id: string; customer_name: string; priceCents: number };
  onClose: () => void;
}

/** Messages from issue_booking_invoice() that already tell the shop what to fix. */
const READABLE_SERVER_ERROR = /Steuernummer|USt-IdNr|two-letter code|street, postcode and city/;

const germanDate = (iso: string) => iso.slice(0, 10).split('-').reverse().join('.');

/**
 * Issue (or reprint) a booking's invoice. Private customer: optional address,
 * required above 250 €. Company: structured address for the E-Rechnung.
 */
export default function InvoiceModal({ booking, onClose }: InvoiceModalProps) {
  const { t } = useAdminText(INVOICE_MODAL_TEXT);
  const [existing, setExisting] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [form, setForm] = useState<InvoiceForm>(EMPTY_INVOICE_FORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    findBookingInvoice(booking.id)
      .then((invoice) => { if (!isCancelled) setExisting(invoice); })
      .catch((loadError) => {
        console.error('Could not look up the invoice:', loadError);
        if (!isCancelled) setError(t.loadFailed);
      })
      .finally(() => { if (!isCancelled) setIsLoading(false); });
    return () => { isCancelled = true; };
  }, [booking.id, t.loadFailed]);

  const set = <K extends keyof InvoiceForm>(key: K, value: InvoiceForm[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const run = async (action: () => Promise<unknown>) => {
    setIsBusy(true);
    setError(null);
    try {
      await action();
      onClose();
    } catch (actionError) {
      console.error('Invoice failed:', actionError);
      const message = actionError instanceof Error ? actionError.message : '';
      setError(READABLE_SERVER_ERROR.test(message) ? message : t.failed);
    } finally {
      setIsBusy(false);
    }
  };

  const create = () => {
    const problem = invoiceFormProblem(form, booking.priceCents);
    if (problem) {
      setError(t[problem]);
      return;
    }
    void run(async () => {
      const invoice = await issueBookingInvoice(booking.id, invoiceRequest(form));
      // From here the number exists: if the PDF fails, the popup offers a reprint, not a new form.
      setExisting(invoice);
      await saveInvoicePdf(invoice);
    });
  };

  const field = (key: Exclude<keyof InvoiceForm, 'kind'>, label: string, extra: { help?: string; className?: string; autoComplete?: string } = {}) => (
    <label htmlFor={`invoice-form-${key}`} className={`block text-sm ${extra.className ?? ''}`}>
      <span className="font-medium text-stone-700">{label}</span>
      <input id={`invoice-form-${key}`} className={`${ADMIN_INPUT} mt-1 bg-white`} value={form[key]} disabled={isBusy}
        autoComplete={extra.autoComplete} onChange={(e) => set(key, e.target.value)} />
      {extra.help && <span className="mt-1 block text-xs text-stone-500">{extra.help}</span>}
    </label>
  );

  const choice = (kind: InvoiceForm['kind']) => {
    const isActive = form.kind === kind;
    const ChoiceIcon = kind === 'private' ? User : Building2;
    return (
      <button key={kind} type="button" role="radio" aria-checked={isActive} disabled={isBusy}
        onClick={() => { set('kind', kind); setError(null); }}
        className={`relative flex flex-1 flex-col items-start gap-2 rounded-2xl px-4 py-3.5 text-left transition ${isActive
          ? 'bg-white shadow-[0_2px_14px_rgba(26,23,20,0.10)] ring-2 ring-[#1A1714]'
          : 'bg-white/60 ring-1 ring-stone-200/80 hover:bg-white hover:ring-stone-300'}`}>
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${isActive ? 'bg-[#1A1714] text-white' : 'bg-stone-100 text-stone-500'}`}>
          <ChoiceIcon className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-[#1A1714]">{kind === 'private' ? t.privateCustomer : t.company}</span>
          <span className="block text-xs text-stone-500">{kind === 'private' ? t.privateHint : t.companyHint}</span>
        </span>
        {isActive && (
          <span className="absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1A1714] text-white">
            <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1A1714]/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="invoice-modal-title">
      <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-[#F7F5F2] shadow-[0_24px_80px_rgba(26,23,20,0.35)]">
        <button type="button" onClick={onClose} aria-label={t.close}
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-900/5 hover:text-stone-700">
          <X className="h-4 w-4" />
        </button>

        <div className="px-7 pb-2 pt-8">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1A1714] text-white">
            <ReceiptEuro className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">{t.title}</p>
          <h2 id="invoice-modal-title" className="mt-1.5 text-[22px] font-semibold leading-tight tracking-tight text-[#1A1714]">{booking.customer_name}</h2>
        </div>

        <div className="space-y-5 px-7 pt-4">
          {isLoading && (
            <p className="flex items-center gap-2 text-sm text-stone-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t.checking}</p>
          )}

          {!isLoading && existing && (
            <div className="rounded-2xl bg-white px-4 py-3.5 text-sm ring-1 ring-emerald-200/80">
              <p className="flex items-center gap-2 font-semibold text-emerald-800">
                <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                {fillText(t.issuedAlready, { number: existing.invoice_number, date: germanDate(issueDate(existing)) })}
              </p>
              <p className="mt-1 text-stone-600">{t.reprintHint}</p>
            </div>
          )}

          {!isLoading && !existing && (
            <>
              <div>
                <p className="mb-2 text-sm font-medium text-stone-700">{t.whoPays}</p>
                <div className="flex gap-3" role="radiogroup" aria-label={t.whoPays}>
                  {choice('private')}
                  {choice('company')}
                </div>
              </div>

              {form.kind === 'private' && field('address', t.address, {
                help: booking.priceCents > SMALL_INVOICE_LIMIT_CENTS ? t.addressRequired : t.addressOptional,
                autoComplete: 'street-address',
              })}

              {form.kind === 'company' && (
                <div className="grid gap-3 sm:grid-cols-6">
                  {field('company', t.companyName, { className: 'sm:col-span-6', autoComplete: 'organization' })}
                  {field('street', t.street, { className: 'sm:col-span-6', autoComplete: 'address-line1' })}
                  {field('postcode', t.postcode, { className: 'sm:col-span-2', autoComplete: 'postal-code' })}
                  {field('city', t.city, { className: 'sm:col-span-3', autoComplete: 'address-level2' })}
                  {field('country', t.country, { className: 'sm:col-span-1', autoComplete: 'country' })}
                  {field('vatId', t.vatId, { className: 'sm:col-span-6' })}
                  {field('reference', t.reference, { className: 'sm:col-span-6', help: t.referenceHelp })}
                </div>
              )}

              <p className="flex gap-2.5 text-xs leading-relaxed text-stone-500">
                <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" aria-hidden="true" />
                <span>{t.einvoiceHint} {t.immutable}</span>
              </p>
            </>
          )}

          {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 px-7 pb-7 pt-6">
          {!isLoading && existing && (
            <button type="button" className={ADMIN_PRIMARY_BUTTON} disabled={isBusy} onClick={() => run(() => saveInvoicePdf(existing))}>
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />} {t.download}
            </button>
          )}
          {!isLoading && !existing && (
            <>
              <button type="button" onClick={onClose} disabled={isBusy}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-stone-500 transition hover:bg-stone-900/5 hover:text-stone-700">
                {t.cancel}
              </button>
              <button type="button" className={ADMIN_PRIMARY_BUTTON} onClick={create} disabled={isBusy}>
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ReceiptEuro className="h-4 w-4" aria-hidden="true" />}
                {isBusy ? t.creating : t.create}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
