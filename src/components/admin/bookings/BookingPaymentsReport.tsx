import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../lib/tenantContext';
import { useCurrency } from '../../../lib/currencyContext';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText, type Translations } from '../../../lib/bookingLanguage';
import { ADMIN_SECONDARY_BUTTON, ADMIN_SURFACE } from '../adminUi';
import { BookingPayment, PAYMENT_METHOD_LABELS, PaymentMethod, totalsByMethod } from './paymentMethods';

interface PaymentRow extends BookingPayment {
  booking: {
    booking_date: string;
    start_time: string;
    customer_name: string;
    service: { name: string } | null;
  } | null;
}

const TEXT: Translations<{
  title: string; subtitle: string; month: string; exportCsv: string; total: string; empty: string;
  loadFailed: string; date: string; appointment: string; customer: string; service: string; method: string;
  reference: string; amount: string; payments: string; voucherNote: string;
}> = {
  en: {
    title: 'Booking payments', subtitle: 'How every appointment was paid, recorded automatically for online payments and vouchers.',
    month: 'Month', exportCsv: 'Export CSV', total: 'Total', empty: 'No payments recorded in this month.',
    loadFailed: 'Could not load the booking payments.', date: 'Paid on', appointment: 'Appointment', customer: 'Customer',
    service: 'Service', method: 'Method', reference: 'Reference', amount: 'Amount', payments: '{count} payments',
    voucherNote: 'Gift card redemptions are not new income: the voucher was taxed when it was sold. Check with your tax advisor.',
  },
  de: {
    title: 'Zahlungen aus Buchungen', subtitle: 'Wie jeder Termin bezahlt wurde; Online-Zahlungen und Gutscheine werden automatisch erfasst.',
    month: 'Monat', exportCsv: 'CSV exportieren', total: 'Summe', empty: 'Keine Zahlungen in diesem Monat erfasst.',
    loadFailed: 'Zahlungen konnten nicht geladen werden.', date: 'Bezahlt am', appointment: 'Termin', customer: 'Kunde',
    service: 'Leistung', method: 'Zahlart', reference: 'Referenz', amount: 'Betrag', payments: '{count} Zahlungen',
    voucherNote: 'Gutschein-Einlösungen sind keine neuen Einnahmen: Der Gutschein wurde beim Verkauf versteuert. Bitte mit der Steuerberatung abstimmen.',
  },
  th: {
    title: 'การชำระเงินจากการจอง', subtitle: 'แสดงว่านัดหมายแต่ละรายการชำระด้วยวิธีใด การชำระออนไลน์และบัตรของขวัญบันทึกอัตโนมัติ',
    month: 'เดือน', exportCsv: 'ส่งออก CSV', total: 'รวม', empty: 'ไม่มีการชำระเงินในเดือนนี้',
    loadFailed: 'โหลดข้อมูลการชำระเงินไม่สำเร็จ', date: 'วันที่ชำระ', appointment: 'นัดหมาย', customer: 'ลูกค้า',
    service: 'บริการ', method: 'วิธีชำระ', reference: 'อ้างอิง', amount: 'จำนวนเงิน', payments: '{count} รายการ',
    voucherNote: 'การใช้บัตรของขวัญไม่ใช่รายได้ใหม่ เพราะเสียภาษีไปแล้วตอนขายบัตร กรุณาตรวจสอบกับนักบัญชี/ที่ปรึกษาภาษี',
  },
};

const currentMonth = (): string => new Date().toISOString().slice(0, 7);

function monthRange(month: string): { from: string; to: string } {
  const [year, monthIndex] = month.split('-').map(Number);
  return {
    from: new Date(Date.UTC(year, monthIndex - 1, 1)).toISOString(),
    to: new Date(Date.UTC(year, monthIndex, 1)).toISOString(),
  };
}

const csvCell = (value: string | number): string => `"${String(value).replace(/"/g, '""')}"`;

export default function BookingPaymentsReport() {
  const { businessId } = useTenant();
  const { t, lang, locale } = useAdminText(TEXT);
  const { formatPrice } = useCurrency();
  const labels = PAYMENT_METHOD_LABELS[lang];
  const [month, setMonth] = useState(currentMonth);
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError('');
    const { from, to } = monthRange(month);
    const { data, error: loadError } = await supabase
      .from('booking_payments')
      .select('*, booking:bookings(booking_date, start_time, customer_name, service:services(name))')
      .eq('business_id', businessId)
      .is('voided_at', null)
      .gte('created_at', from)
      .lt('created_at', to)
      .order('created_at');
    if (loadError) {
      console.error('Could not load booking payments:', loadError);
      setError(t.loadFailed);
    } else {
      setRows((data ?? []) as unknown as PaymentRow[]);
    }
    setLoading(false);
  }, [businessId, month, t.loadFailed]);

  useEffect(() => { load(); }, [load]);

  const visibleRows = useMemo(() => rows.filter((row) => row.amount_cents > 0), [rows]);
  const totals = useMemo(() => totalsByMethod(visibleRows), [visibleRows]);
  const grandTotal = totals.reduce((sum, total) => sum + total.cents, 0);
  const formatDate = (value: string) => new Date(value).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });

  const exportCsv = () => {
    // German column names and decimal commas: the file is meant for a German tax advisor.
    const header = ['Bezahlt am', 'Termin', 'Uhrzeit', 'Kunde', 'Leistung', 'Zahlart', 'Referenz', 'Betrag (EUR)'];
    const lines = visibleRows.map((row) => [
      row.created_at.slice(0, 10),
      row.booking?.booking_date ?? '',
      row.booking?.start_time?.slice(0, 5) ?? '',
      row.booking?.customer_name ?? '',
      row.booking?.service?.name ?? '',
      PAYMENT_METHOD_LABELS.de[row.method as PaymentMethod],
      row.reference ?? '',
      (row.amount_cents / 100).toFixed(2).replace('.', ','),
    ].map(csvCell).join(';'));
    const blob = new Blob([`﻿${[header.map(csvCell).join(';'), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Zahlungen-Buchungen_${month}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <section className="space-y-5" aria-labelledby="booking-payments-title">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 id="booking-payments-title" className="text-lg font-semibold tracking-tight text-[#1A1714]">{t.title}</h2>
          <p className="mt-0.5 max-w-xl text-sm text-stone-500">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="booking-payments-month">{t.month}</label>
          <input id="booking-payments-month" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="rounded-xl border border-stone-200 bg-white/80 px-3 py-2 text-sm" />
          <button type="button" onClick={exportCsv} disabled={visibleRows.length === 0} className={ADMIN_SECONDARY_BUTTON}>
            <Download className="h-4 w-4" aria-hidden="true" /> {t.exportCsv}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className={`${ADMIN_SURFACE} col-span-2 p-5 md:col-span-1`}>
          <p className="text-[13px] font-medium text-stone-500">{t.total}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-[#1A1714]">{formatPrice(grandTotal)}</p>
          <p className="mt-1 text-xs text-stone-400">{fillText(t.payments, { count: visibleRows.length })}</p>
        </div>
        {totals.map((total) => (
          <div key={total.method} className={`${ADMIN_SURFACE} p-5`}>
            <p className="text-[13px] font-medium text-stone-500">{labels[total.method]}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[#1A1714]">{formatPrice(total.cents)}</p>
            <p className="mt-1 text-xs text-stone-400">{fillText(t.payments, { count: total.count })}</p>
          </div>
        ))}
      </div>

      {totals.some((total) => total.method === 'gift_card' || total.method === 'service_pass') && (
        <p className="rounded-xl bg-stone-900/[0.04] px-4 py-3 text-xs text-stone-600">{t.voucherNote}</p>
      )}

      <div className={`${ADMIN_SURFACE} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200/70 text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              <th className="px-5 py-3">{t.date}</th>
              <th className="px-5 py-3">{t.appointment}</th>
              <th className="px-5 py-3">{t.customer}</th>
              <th className="px-5 py-3">{t.method}</th>
              <th className="px-5 py-3">{t.reference}</th>
              <th className="px-5 py-3 text-right">{t.amount}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200/60">
            {!loading && visibleRows.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-stone-400">{t.empty}</td></tr>
            )}
            {visibleRows.map((row) => (
              <tr key={row.id}>
                <td className="px-5 py-3 tabular-nums text-stone-600">{formatDate(row.created_at)}</td>
                <td className="px-5 py-3 text-stone-700">
                  {row.booking ? `${formatDate(row.booking.booking_date)} · ${row.booking.start_time.slice(0, 5)}` : '–'}
                  {row.booking?.service?.name && <span className="block text-xs text-stone-400">{row.booking.service.name}</span>}
                </td>
                <td className="px-5 py-3 text-stone-700">{row.booking?.customer_name ?? '–'}</td>
                <td className="px-5 py-3 text-stone-700">{labels[row.method]}</td>
                <td className="px-5 py-3 font-mono text-xs text-stone-400">{row.reference ?? ''}</td>
                <td className="px-5 py-3 text-right font-medium tabular-nums text-[#1A1714]">{formatPrice(row.amount_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
