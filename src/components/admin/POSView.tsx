import { useState, useEffect } from 'react';
import { Gift, Search, Check, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';
import { useCurrency } from '../../lib/currencyContext';
import {
  ADMIN_INPUT,
  ADMIN_PRIMARY_BUTTON,
  ADMIN_SEGMENT_ACTIVE,
  ADMIN_SEGMENT_INACTIVE,
  ADMIN_SEGMENTED_CONTROL,
  ADMIN_SURFACE,
} from './adminUi';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, Translations } from '../../lib/bookingLanguage';

type PosText = {
  notFound: string; notUsable: string; statusExpired: string; statusFullyRedeemed: string; statusCancelled: string;
  statusPendingPayment: string; statusInactive: string; noVisitsLeft: string; zeroBalance: string; passRedeemFailed: string;
  visitRedeemedOne: string; visitRedeemedMany: string; amountRange: string; redeemedSuccess: string; redeemFailed: string;
  confirmMarkPaid: string; bookingUpdateFailed: string; bookingMarkedPaid: string; title: string; subtitle: string;
  pendingCountOne: string; pendingCountMany: string; tabRedeem: string; tabPending: string; findHeading: string;
  findHint: string; codeLabel: string; searching: string; findCard: string; serviceEntitlement: string;
  availableBalance: string; visitLeft: string; visitsLeft: string; minutes: string; passHint: string; processing: string;
  redeemOneVisit: string; amountToRedeem: string; redeemValue: string; maximum: string; bookingsHeading: string;
  bookingsHint: string; emptyTitle: string; emptyHint: string; colDateTime: string; colCustomer: string; colService: string;
  colAmount: string; colActions: string; markPaid: string;
};

const TEXT: Translations<PosText> = {
  en: {
    notFound: 'Gift card not found', notUsable: 'This gift card is {status} and cannot be used',
    statusExpired: 'expired', statusFullyRedeemed: 'fully redeemed', statusCancelled: 'cancelled',
    statusPendingPayment: 'awaiting payment', statusInactive: 'inactive',
    noVisitsLeft: 'This service pass has no visits remaining', zeroBalance: 'This gift card has a zero balance',
    passRedeemFailed: 'Failed to redeem service pass', visitRedeemedOne: 'Visit redeemed. 1 visit remains.',
    visitRedeemedMany: 'Visit redeemed. {count} visits remain.', amountRange: 'Amount must be between {min} and {max}',
    redeemedSuccess: 'Successfully redeemed {amount} from gift card!', redeemFailed: 'Failed to redeem gift card',
    confirmMarkPaid: 'Mark this booking as paid?', bookingUpdateFailed: 'Failed to update booking',
    bookingMarkedPaid: 'Booking marked as paid!', title: 'Checkout desk',
    subtitle: 'Redeem value cards or service-pass visits and close pending in-person payments.',
    pendingCountOne: '1 pending payment', pendingCountMany: '{count} pending payments',
    tabRedeem: 'Redeem card or pass', tabPending: 'Pending payments', findHeading: 'Find a card or pass',
    findHint: 'Scan a code or enter it exactly as shown to check its live balance or remaining visits.',
    codeLabel: 'Card or pass code', searching: 'Searching…', findCard: 'Find card',
    serviceEntitlement: 'Service entitlement', availableBalance: 'Available balance',
    visitLeft: '1 visit left', visitsLeft: '{count} visits left', minutes: '{count} min',
    passHint: 'Redeem one visit for the service shown above. This records the current service value but never turns the pass into cash.',
    processing: 'Processing…', redeemOneVisit: 'Redeem one visit', amountToRedeem: 'Amount to redeem ({symbol})',
    redeemValue: 'Redeem value', maximum: 'Maximum {amount}', bookingsHeading: 'Bookings awaiting payment',
    bookingsHint: 'Use this after collecting payment at the venue.', emptyTitle: 'Nothing waiting for payment',
    emptyHint: 'New pay-at-venue bookings appear here.', colDateTime: 'Date & time', colCustomer: 'Customer',
    colService: 'Service', colAmount: 'Amount', colActions: 'Actions', markPaid: 'Mark paid',
  },
  de: {
    notFound: 'Gutschein nicht gefunden', notUsable: 'Dieser Gutschein ist {status} und kann nicht verwendet werden',
    statusExpired: 'abgelaufen', statusFullyRedeemed: 'vollständig eingelöst', statusCancelled: 'storniert',
    statusPendingPayment: 'noch nicht bezahlt', statusInactive: 'inaktiv',
    noVisitsLeft: 'Für diesen Behandlungsgutschein sind keine Besuche mehr übrig', zeroBalance: 'Dieser Gutschein hat kein Guthaben mehr',
    passRedeemFailed: 'Behandlungsgutschein konnte nicht eingelöst werden', visitRedeemedOne: 'Besuch eingelöst. 1 Besuch verbleibt.',
    visitRedeemedMany: 'Besuch eingelöst. {count} Besuche verbleiben.', amountRange: 'Der Betrag muss zwischen {min} und {max} liegen',
    redeemedSuccess: '{amount} vom Gutschein eingelöst.', redeemFailed: 'Gutschein konnte nicht eingelöst werden',
    confirmMarkPaid: 'Diese Buchung als bezahlt markieren?', bookingUpdateFailed: 'Buchung konnte nicht aktualisiert werden',
    bookingMarkedPaid: 'Buchung als bezahlt markiert.', title: 'Kasse',
    subtitle: 'Wertgutscheine oder Besuche von Behandlungsgutscheinen einlösen und offene Zahlungen vor Ort abschließen.',
    pendingCountOne: '1 offene Zahlung', pendingCountMany: '{count} offene Zahlungen',
    tabRedeem: 'Gutschein einlösen', tabPending: 'Offene Zahlungen', findHeading: 'Gutschein suchen',
    findHint: 'Code scannen oder genau wie angezeigt eingeben, um das aktuelle Guthaben oder die verbleibenden Besuche zu prüfen.',
    codeLabel: 'Gutscheincode', searching: 'Suche läuft…', findCard: 'Gutschein suchen',
    serviceEntitlement: 'Leistungsanspruch', availableBalance: 'Verfügbares Guthaben',
    visitLeft: 'Noch 1 Besuch', visitsLeft: 'Noch {count} Besuche', minutes: '{count} Min.',
    passHint: 'Einen Besuch für die oben angezeigte Leistung einlösen. Dabei wird der aktuelle Leistungswert erfasst, der Gutschein wird aber nie in Bargeld umgewandelt.',
    processing: 'Wird verarbeitet…', redeemOneVisit: 'Einen Besuch einlösen', amountToRedeem: 'Einzulösender Betrag ({symbol})',
    redeemValue: 'Betrag einlösen', maximum: 'Maximal {amount}', bookingsHeading: 'Buchungen mit offener Zahlung',
    bookingsHint: 'Nutzen Sie dies, nachdem die Zahlung vor Ort erfolgt ist.', emptyTitle: 'Keine offenen Zahlungen',
    emptyHint: 'Neue Buchungen mit Zahlung vor Ort erscheinen hier.', colDateTime: 'Datum & Uhrzeit', colCustomer: 'Kund:in',
    colService: 'Leistung', colAmount: 'Betrag', colActions: 'Aktionen', markPaid: 'Als bezahlt markieren',
  },
  th: {
    notFound: 'ไม่พบบัตรของขวัญ', notUsable: 'บัตรของขวัญนี้{status} จึงใช้งานไม่ได้',
    statusExpired: 'หมดอายุแล้ว', statusFullyRedeemed: 'ใช้ครบแล้ว', statusCancelled: 'ถูกยกเลิกแล้ว',
    statusPendingPayment: 'ยังไม่ชำระ', statusInactive: 'ยังไม่เปิดใช้งาน',
    noVisitsLeft: 'บัตรบริการนี้ไม่มีสิทธิ์คงเหลือแล้ว', zeroBalance: 'บัตรของขวัญนี้ไม่มียอดคงเหลือ',
    passRedeemFailed: 'ใช้บัตรบริการไม่สำเร็จ', visitRedeemedOne: 'ใช้สิทธิ์แล้ว เหลืออีก 1 ครั้ง',
    visitRedeemedMany: 'ใช้สิทธิ์แล้ว เหลืออีก {count} ครั้ง', amountRange: 'จำนวนเงินต้องอยู่ระหว่าง {min} ถึง {max}',
    redeemedSuccess: 'ใช้บัตรของขวัญ {amount} สำเร็จ', redeemFailed: 'ใช้บัตรของขวัญไม่สำเร็จ',
    confirmMarkPaid: 'ทำเครื่องหมายว่าการจองนี้ชำระแล้ว?', bookingUpdateFailed: 'อัปเดตการจองไม่สำเร็จ',
    bookingMarkedPaid: 'ทำเครื่องหมายว่าชำระแล้ว', title: 'แคชเชียร์',
    subtitle: 'ใช้บัตรของขวัญแบบมูลค่าหรือบัตรบริการ และปิดยอดที่ชำระที่ร้าน',
    pendingCountOne: 'รอชำระ 1 รายการ', pendingCountMany: 'รอชำระ {count} รายการ',
    tabRedeem: 'ใช้บัตรของขวัญ', tabPending: 'รอชำระเงิน', findHeading: 'ค้นหาบัตรของขวัญ',
    findHint: 'สแกนหรือกรอกรหัสให้ตรงตามที่แสดง เพื่อตรวจสอบยอดคงเหลือหรือจำนวนครั้งที่เหลือ',
    codeLabel: 'รหัสบัตรของขวัญ', searching: 'กำลังค้นหา…', findCard: 'ค้นหาบัตร',
    serviceEntitlement: 'สิทธิ์ใช้บริการ', availableBalance: 'ยอดคงเหลือที่ใช้ได้',
    visitLeft: 'เหลือ 1 ครั้ง', visitsLeft: 'เหลือ {count} ครั้ง', minutes: '{count} นาที',
    passHint: 'ใช้สิทธิ์ 1 ครั้งสำหรับบริการด้านบน ระบบจะบันทึกมูลค่าบริการปัจจุบัน แต่บัตรจะไม่ถูกแปลงเป็นเงินสด',
    processing: 'กำลังดำเนินการ…', redeemOneVisit: 'ใช้สิทธิ์ 1 ครั้ง', amountToRedeem: 'จำนวนเงินที่ใช้ ({symbol})',
    redeemValue: 'ใช้ยอดเงิน', maximum: 'สูงสุด {amount}', bookingsHeading: 'การจองที่รอชำระเงิน',
    bookingsHint: 'ใช้หลังจากรับชำระเงินที่ร้านแล้ว', emptyTitle: 'ไม่มีรายการรอชำระ',
    emptyHint: 'การจองที่ชำระที่ร้านจะแสดงที่นี่', colDateTime: 'วันและเวลา', colCustomer: 'ลูกค้า',
    colService: 'บริการ', colAmount: 'จำนวนเงิน', colActions: 'การดำเนินการ', markPaid: 'ทำเครื่องหมายว่าชำระแล้ว',
  },
};

const CARD_STATUS_KEYS: Record<string, keyof PosText> = {
  expired: 'statusExpired',
  fully_redeemed: 'statusFullyRedeemed',
  redeemed: 'statusFullyRedeemed',
  cancelled: 'statusCancelled',
  pending_payment: 'statusPendingPayment',
};

interface GiftCard {
  id: string;
  code: string;
  original_value_cents: number;
  current_balance_cents: number;
  card_type?: 'value' | 'service_pass';
  service_pass_name?: string | null;
  original_visits?: number | null;
  remaining_visits?: number | null;
  status: string;
  expires_at: string | null;
  service?: { name: string } | null;
  duration?: { duration_minutes: number; price_cents: number } | null;
}

interface PendingBooking {
  id: string;
  booking_date: string;
  start_time: string;
  customer_name: string;
  customer_email: string;
  payment_status: string;
  service: {
    name: string;
  };
  duration: {
    price_cents: number;
    duration_minutes: number;
  };
}

export function POSView() {
  const { businessId } = useTenant();
  const { formatAmount, currencySymbol } = useCurrency();
  const { t, locale } = useAdminText(TEXT);
  const [activeTab, setActiveTab] = useState<'gift_cards' | 'bookings'>('gift_cards');

  // Gift card state
  const [giftCardCode, setGiftCardCode] = useState('');
  const [searchingCard, setSearchingCard] = useState(false);
  const [foundCard, setFoundCard] = useState<GiftCard | null>(null);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Pending bookings state
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  useEffect(() => {
    loadPendingBookings();
  }, [businessId]);

  const loadPendingBookings = async () => {
    setLoadingBookings(true);
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        service:services(name),
        duration:service_durations(price_cents, duration_minutes)
      `)
      .eq('business_id', businessId)
      .eq('payment_status', 'pending')
      // Cancelled bookings and no-shows are not collected at the counter.
      .neq('status', 'cancelled')
      .or('no_show.is.null,no_show.eq.false')
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (!error && data) {
      setPendingBookings(data);
    }
    setLoadingBookings(false);
  };

  const handleSearchGiftCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!giftCardCode.trim()) return;

    setSearchingCard(true);
    setError('');
    setMessage('');
    setFoundCard(null);

    const { data: card, error: cardError } = await supabase
      .from('gift_cards')
      .select('*, service:services(name), duration:service_durations(duration_minutes, price_cents)')
      .eq('code', giftCardCode.toUpperCase().trim())
      .eq('business_id', businessId)
      .maybeSingle();

    if (cardError || !card) {
      setError(t.notFound);
      setSearchingCard(false);
      return;
    }

    if (card.status !== 'active') {
      setError(fillText(t.notUsable, { status: t[CARD_STATUS_KEYS[card.status] ?? 'statusInactive'] }));
      setSearchingCard(false);
      return;
    }

    if (card.card_type === 'service_pass' ? (card.remaining_visits || 0) <= 0 : card.current_balance_cents <= 0) {
      setError(card.card_type === 'service_pass' ? t.noVisitsLeft : t.zeroBalance);
      setSearchingCard(false);
      return;
    }

    setFoundCard(card);
    setRedeemAmount(card.card_type === 'service_pass' ? '' : ((card.current_balance_cents / 100).toFixed(2)));
    setSearchingCard(false);
  };

  const handleRedeemGiftCard = async () => {
    if (!foundCard) return;

    if (foundCard.card_type === 'service_pass') {
      setRedeeming(true);
      setError('');
      const { data, error: redemptionError } = await supabase.rpc('redeem_service_pass_at_pos', {
        p_code: foundCard.code,
      });

      if (redemptionError) {
        setError(redemptionError.message || t.passRedeemFailed);
      } else {
        const remainingVisits = Number(data?.remainingVisits || 0);
        setMessage(remainingVisits === 1 ? t.visitRedeemedOne : fillText(t.visitRedeemedMany, { count: remainingVisits }));
        setGiftCardCode('');
        setFoundCard(null);
        setTimeout(() => setMessage(''), 5000);
      }
      setRedeeming(false);
      return;
    }

    const amountCents = Math.round(parseFloat(redeemAmount) * 100);

    if (amountCents <= 0 || amountCents > foundCard.current_balance_cents) {
      setError(fillText(t.amountRange, { min: formatAmount(0.01), max: formatAmount(foundCard.current_balance_cents / 100) }));
      return;
    }

    setRedeeming(true);
    setError('');

    try {
      const newBalance = foundCard.current_balance_cents - amountCents;
      const newStatus = newBalance === 0 ? 'fully_redeemed' : 'active';

      // Update gift card balance
      const { error: updateError } = await supabase
        .from('gift_cards')
        .update({
          current_balance_cents: newBalance,
          status: newStatus,
        })
        .eq('id', foundCard.id);

      if (updateError) throw updateError;

      // Record transaction
      await supabase
        .from('gift_card_transactions')
        .insert({
          gift_card_id: foundCard.id,
          amount_cents: -amountCents,
          transaction_type: 'redemption',
          description: `Redeemed ${formatAmount(amountCents / 100)} at POS`,
        });

      setMessage(fillText(t.redeemedSuccess, { amount: formatAmount(amountCents / 100) }));
      setGiftCardCode('');
      setFoundCard(null);
      setRedeemAmount('');
      setTimeout(() => setMessage(''), 5000);
    } catch (err: any) {
      setError(err.message || t.redeemFailed);
    } finally {
      setRedeeming(false);
    }
  };

  const handleMarkAsPaid = async (bookingId: string) => {
    if (!confirm(t.confirmMarkPaid)) return;

    const { error } = await supabase
      .from('bookings')
      // Records the payment only; the appointment status stays as it is.
      .update({ payment_status: 'completed' })
      .eq('id', bookingId);

    if (error) {
      setError(t.bookingUpdateFailed);
    } else {
      setError('');
      setMessage(t.bookingMarkedPaid);
      loadPendingBookings();
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[#1A1714]">{t.title}</h2>
          <p className="mt-1 text-sm text-stone-500">{t.subtitle}</p>
        </div>
        <span className="text-xs text-stone-400">{pendingBookings.length === 1 ? t.pendingCountOne : fillText(t.pendingCountMany, { count: pendingBookings.length })}</span>
      </div>

      {(message || error) && (
        <div role="status" className={`rounded-2xl border px-4 py-3 text-sm ${error ? 'border-red-200/80 bg-red-50/70 text-red-700' : 'border-emerald-200/80 bg-emerald-50/70 text-emerald-800'}`}>
          {error || message}
        </div>
      )}

      <div className="overflow-x-auto pb-1">
        <div className={`${ADMIN_SEGMENTED_CONTROL} min-w-max`}>
          <button
            type="button"
            onClick={() => setActiveTab('gift_cards')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'gift_cards' ? ADMIN_SEGMENT_ACTIVE : ADMIN_SEGMENT_INACTIVE
            }`}
          >
            <Gift className="h-4 w-4" strokeWidth={1.75} />
            {t.tabRedeem}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bookings')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'bookings' ? ADMIN_SEGMENT_ACTIVE : ADMIN_SEGMENT_INACTIVE
            }`}
          >
            <DollarSign className="h-4 w-4" strokeWidth={1.75} />
            {t.tabPending}
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${activeTab === 'bookings' ? 'bg-white/[0.15]' : 'bg-stone-900/[0.05]'}`}>
              {pendingBookings.length}
            </span>
          </button>
        </div>
      </div>

      {activeTab === 'gift_cards' && (
        <section className={`${ADMIN_SURFACE} p-6`}>
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-900/[0.06] text-[#1A1714]">
              <Gift className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-semibold text-[#1A1714]">{t.findHeading}</h3>
              <p className="mt-1 text-sm text-stone-500">{t.findHint}</p>
            </div>
          </div>

          <form onSubmit={handleSearchGiftCard}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-stone-700">{t.codeLabel}</span>
              <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={giftCardCode}
                    onChange={(e) => setGiftCardCode(e.target.value)}
                    className={`${ADMIN_INPUT} flex-1 uppercase`}
                    placeholder="GC-XXXX-XXXX-XXXX"
                    required
                  />
                  <button
                    type="submit"
                    disabled={searchingCard}
                    className={ADMIN_PRIMARY_BUTTON}
                  >
                    <Search className="h-4 w-4" />
                    {searchingCard ? t.searching : t.findCard}
                  </button>
              </div>
            </label>
          </form>

          {foundCard && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-emerald-200/70 bg-emerald-50/60">
              <div className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-emerald-700/70">{foundCard.card_type === 'service_pass' ? t.serviceEntitlement : t.availableBalance}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-emerald-950">
                    {foundCard.card_type === 'service_pass'
                      ? ((foundCard.remaining_visits || 0) === 1 ? t.visitLeft : fillText(t.visitsLeft, { count: foundCard.remaining_visits || 0 }))
                      : formatAmount(foundCard.current_balance_cents / 100)}
                  </p>
                  {foundCard.card_type === 'service_pass' && (
                    <p className="mt-1 text-sm text-emerald-800">{foundCard.service_pass_name} · {foundCard.service?.name} · {fillText(t.minutes, { count: foundCard.duration?.duration_minutes ?? '' })}</p>
                  )}
                  <p className="mt-1 font-mono text-xs text-emerald-700/70">{foundCard.code}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.65] text-emerald-700 ring-1 ring-emerald-900/[0.05]">
                  <Check className="h-6 w-6" />
                </div>
              </div>

              <div className="border-t border-emerald-200/70 bg-white/30 p-5">
                {foundCard.card_type === 'service_pass' ? (
                  <div>
                    <p className="text-sm leading-6 text-emerald-900">{t.passHint}</p>
                    <button type="button" onClick={handleRedeemGiftCard} disabled={redeeming} className={`${ADMIN_PRIMARY_BUTTON} mt-4 w-full`}>
                      {redeeming ? t.processing : t.redeemOneVisit}
                    </button>
                  </div>
                ) : (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-emerald-950">{fillText(t.amountToRedeem, { symbol: currencySymbol })}</span>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="number"
                      value={redeemAmount}
                      onChange={(e) => setRedeemAmount(e.target.value)}
                      className={`${ADMIN_INPUT} flex-1`}
                      step="0.01"
                      min="0.01"
                      max={(foundCard.current_balance_cents / 100).toFixed(2)}
                      required
                    />
                    <button
                      type="button"
                      onClick={handleRedeemGiftCard}
                      disabled={redeeming}
                      className={ADMIN_PRIMARY_BUTTON}
                    >
                      {redeeming ? t.processing : t.redeemValue}
                    </button>
                  </div>
                  <span className="mt-1.5 block text-xs text-emerald-700/70">{fillText(t.maximum, { amount: formatAmount(foundCard.current_balance_cents / 100) })}</span>
                </label>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === 'bookings' && (
        <section className={`${ADMIN_SURFACE} overflow-hidden`}>
          <div className="border-b border-stone-200/70 px-5 py-4">
            <h3 className="font-semibold text-[#1A1714]">{t.bookingsHeading}</h3>
            <p className="mt-1 text-xs text-stone-400">{t.bookingsHint}</p>
          </div>
          {loadingBookings ? (
            <div className="animate-pulse space-y-3 p-5">
              {[0, 1, 2].map((row) => <div key={row} className="h-14 rounded-xl bg-stone-900/[0.035]" />)}
            </div>
          ) : pendingBookings.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <Check className="mx-auto h-6 w-6 text-emerald-500" strokeWidth={1.75} />
              <p className="mt-3 text-sm font-medium text-stone-600">{t.emptyTitle}</p>
              <p className="mt-1 text-xs text-stone-400">{t.emptyHint}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead className="bg-stone-900/[0.025]">
                  <tr>
                    {[t.colDateTime, t.colCustomer, t.colService, t.colAmount].map((heading) => (
                      <th key={heading} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">{heading}</th>
                    ))}
                    <th className="px-5 py-3 text-right"><span className="sr-only">{t.colActions}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200/60">
                  {pendingBookings.map((booking) => (
                    <tr key={booking.id} className="transition-colors hover:bg-white/60">
                      <td className="px-5 py-4">
                        <div className="text-sm">
                          <p className="font-medium text-[#1A1714]">
                            {new Date(booking.booking_date).toLocaleDateString(locale)}
                          </p>
                          <p className="mt-0.5 text-xs text-stone-400">{booking.start_time}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm">
                          <p className="font-medium text-[#1A1714]">{booking.customer_name}</p>
                          <p className="mt-0.5 text-xs text-stone-400">{booking.customer_email}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm">
                          <p className="font-medium text-[#1A1714]">{booking.service.name}</p>
                          <p className="mt-0.5 text-xs text-stone-400">{fillText(t.minutes, { count: booking.duration.duration_minutes })}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-[#1A1714]">
                          {formatAmount(booking.duration.price_cents / 100)}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleMarkAsPaid(booking.id)}
                          className={ADMIN_PRIMARY_BUTTON}
                        >
                          <Check className="h-4 w-4" /> {t.markPaid}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
