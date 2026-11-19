import { useEffect, useState } from 'react';
import { Building2, Download, Loader2, Receipt, User, X } from 'lucide-react';
import { findBookingInvoice, issueBookingInvoice, saveInvoicePdf } from '../../../lib/invoice/invoiceApi';
import { issueDate, type Invoice } from '../../../lib/invoice/invoiceText';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText } from '../../../lib/bookingLanguage';
import { ADMIN_INPUT, ADMIN_MODAL_BACKDROP, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_SEGMENTED_CONTROL, ADMIN_SEGMENT_ACTIVE, ADMIN_SEGMENT_INACTIVE } from '../adminUi';
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
      <input id={`invoice-form-${key}`} className={`${ADMIN_INPUT} mt-1`} value={form[key]} disabled={isBusy}
        autoComplete={extra.autoComplete} onChange={(e) => set(key, e.target.value)} />
      {extra.help && <span className="mt-1 block text-xs text-stone-500">{extra.help}</span>}
    </label>
  );

  return (
    <div className={ADMIN_MODAL_BACKDROP} role="dialog" aria-modal="true" aria-labelledby="invoice-modal-title">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-stone-600" aria-hidden="true" />
            <h2 id="invoice-modal-title" className="text-lg font-semibold text-[#1A1714]">{t.title} · {booking.customer_name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t.close} className="text-stone-400 hover:text-stone-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading && (
          <p className="flex items-center gap-2 text-sm text-stone-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t.checking}</p>
        )}

        {!isLoading && existing && (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <p className="font-medium">{fillText(t.issuedAlready, { number: existing.invoice_number, date: germanDate(issueDate(existing)) })}</p>
              <p className="mt-1 text-emerald-800">{t.reprintHint}</p>
            </div>
            <div className="flex justify-end">
              <button type="button" className={ADMIN_PRIMARY_BUTTON} disabled={isBusy} onClick={() => run(() => saveInvoicePdf(existing))}>
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />} {t.download}
              </button>
            </div>
          </div>
        )}

        {!isLoading && !existing && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-stone-700">{t.whoPays}</p>
              <div className={ADMIN_SEGMENTED_CONTROL} role="radiogroup" aria-label={t.whoPays}>
                {(['private', 'company'] as const).map((kind) => (
                  <button key={kind} type="button" role="radio" aria-checked={form.kind === kind} disabled={isBusy}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${form.kind === kind ? ADMIN_SEGMENT_ACTIVE : ADMIN_SEGMENT_INACTIVE}`}
                    onClick={() => { set('kind', kind); setError(null); }}>
                    {kind === 'private' ? <User className="h-4 w-4" aria-hidden="true" /> : <Building2 className="h-4 w-4" aria-hidden="true" />}
                    {kind === 'private' ? t.privateCustomer : t.company}
                  </button>
                ))}
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

            <p className="rounded-xl bg-stone-50 px-4 py-3 text-xs text-stone-600">{t.einvoiceHint} {t.immutable}</p>
          </div>
        )}

        {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}

        {!isLoading && !existing && (
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button type="button" className={ADMIN_SECONDARY_BUTTON} onClick={onClose} disabled={isBusy}>{t.cancel}</button>
            <button type="button" className={ADMIN_PRIMARY_BUTTON} onClick={create} disabled={isBusy}>
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Receipt className="h-4 w-4" aria-hidden="true" />}
              {isBusy ? t.creating : t.create}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
