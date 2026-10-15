import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { DollarSign, Check, Search, AlertCircle, CreditCard, Ban, RotateCcw, Loader2, HelpCircle, X } from 'lucide-react';
import { adminAuth } from '../../lib/adminAuth';
import NoShowAnalytics from './noshow/NoShowAnalytics';
import UnbilledNoShowRows, { type UnbilledNoShowRow } from './noshow/UnbilledNoShowRows';
import { createUnpaidNoShowFees } from '../../lib/noShowFees';
import { useCurrency } from '../../lib/currencyContext';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, type Translations } from '../../lib/bookingLanguage';
import {
  ADMIN_ICON_TILE,
  ADMIN_INPUT,
  ADMIN_PRIMARY_BUTTON,
  ADMIN_SECONDARY_BUTTON,
  ADMIN_SEGMENT_ACTIVE,
  ADMIN_SEGMENT_INACTIVE,
  ADMIN_SEGMENTED_CONTROL,
  ADMIN_STATUS_PILL,
  ADMIN_SURFACE,
  ADMIN_SURFACE_INTERACTIVE,
  ADMIN_TERTIARY_BUTTON,
} from './adminUi';

type FeeResolution = 'unpaid' | 'paid' | 'waived';

type FeeText = {
  noBusiness: string; loadFailed: string; title: string; subtitle: string; howItWorks: string; guideTitle: string;
  guideCharge: string; guideChargeBody: string; guideMarkPaid: string; guideMarkPaidBody: string; guideWaive: string; guideWaiveBody: string;
  closeGuide: string; outstanding: string; includesUnbilled: string; collected: string; waived: string; searchPlaceholder: string;
  all: string; unpaid: string; paid: string; colCustomer: string; colReason: string; colAmount: string; colBilledOn: string;
  colStatus: string; colActions: string; noFees: string; unknown: string; noShow: string; lateCancel: string; updating: string;
  reopen: string; chargeCard: string; chargeRecorded: string; noSavedCard: string; markPaid: string; waive: string; noCardHint: string;
  showing: string; thisCustomer: string; confirmWaive: string; confirmCharge: string;
  feeAdded: string; markedPaid: string; markPaidFailed: string; reopened: string; reopenFailed: string; feeWaived: string;
  waiveFailed: string; cardCharged: string; noCardOnFile: string; paymentsNotConnected: string; noFeeConfigured: string;
  alreadyCharged: string; chargeFailed: string; chargeFailedGeneric: string;
};

const TEXT: Translations<FeeText> = {
  en: {
    noBusiness: 'Unable to determine your business. Please try logging in again.', loadFailed: 'Failed to load no-show fees.',
    title: 'No-Show Fees', subtitle: 'Collect, record, or waive each fee. Resolved fees leave the Action Centre automatically.',
    howItWorks: 'How does this work?', guideTitle: 'How to clear an unpaid fee',
    guideCharge: 'Charge card', guideChargeBody: 'charges the card the customer saved at booking through Stripe.',
    guideMarkPaid: 'Mark paid', guideMarkPaidBody: "only records money you already received (cash, bank transfer, terminal) — it doesn't charge anyone.",
    guideWaive: 'Waive', guideWaiveBody: 'closes the fee without collecting it.',
    closeGuide: 'Close guide', outstanding: 'Outstanding', includesUnbilled: 'Includes {amount} not billed yet', collected: 'Collected',
    waived: 'Waived', searchPlaceholder: 'Search by customer name or email...', all: 'All', unpaid: 'Unpaid', paid: 'Paid',
    colCustomer: 'Customer', colReason: 'Reason', colAmount: 'Amount', colBilledOn: 'Billed on', colStatus: 'Status', colActions: 'Actions',
    noFees: 'No fees found', unknown: 'Unknown', noShow: 'No-Show', lateCancel: 'Late Cancel', updating: 'Updating fee…',
    reopen: 'Reopen', chargeCard: 'Charge card', chargeRecorded: 'Charge recorded', noSavedCard: 'No saved card', markPaid: 'Mark paid',
    waive: 'Waive', noCardHint: 'No card was saved, so collect it yourself, then “Mark paid”.',
    showing: 'Showing {shown} of {total} no-shows', thisCustomer: 'this customer',
    confirmWaive: 'Waive {amount} for {name}? The fee will be closed without recording payment.',
    confirmCharge: 'Charge {amount} to the saved card for {name}?',
    feeAdded: 'Fee added for {name}. Now charge the card, mark it paid, or waive it.',
    markedPaid: 'Fee marked paid. It has left the Action Centre.', markPaidFailed: 'We could not mark this fee paid. Please try again.',
    reopened: 'Fee reopened and returned to the Action Centre.', reopenFailed: 'We could not reopen this fee. Please try again.',
    feeWaived: 'Fee waived. It has left the Action Centre.', waiveFailed: 'We could not waive this fee. Please try again.',
    cardCharged: 'Card charged {amount}. The fee is resolved.',
    noCardOnFile: 'This booking has no saved card. Record an external payment or waive the fee.',
    paymentsNotConnected: 'Connect Stripe in Settings → Payments before charging saved cards.',
    noFeeConfigured: 'This service no longer has a no-show fee configured.',
    alreadyCharged: 'This booking was already charged. Refreshing its fee status now.',
    chargeFailed: 'The saved card could not be charged. Ask the customer to pay another way or waive the fee.',
    chargeFailedGeneric: 'The saved card could not be charged.',
  },
  de: {
    noBusiness: 'Ihr Betrieb konnte nicht ermittelt werden. Bitte melden Sie sich erneut an.', loadFailed: 'No-Show-Gebühren konnten nicht geladen werden.',
    title: 'No-Show-Gebühren', subtitle: 'Jede Gebühr belasten, als bezahlt erfassen oder erlassen. Erledigte Gebühren verschwinden automatisch aus dem Action Centre.',
    howItWorks: 'Wie funktioniert das?', guideTitle: 'So erledigen Sie eine offene Gebühr',
    guideCharge: 'Karte belasten', guideChargeBody: 'belastet die Karte, die der Kunde bei der Buchung über Stripe hinterlegt hat.',
    guideMarkPaid: 'Als bezahlt markieren', guideMarkPaidBody: 'erfasst nur Geld, das Sie bereits erhalten haben (bar, Überweisung, Terminal) — es wird nichts belastet.',
    guideWaive: 'Erlassen', guideWaiveBody: 'schließt die Gebühr, ohne sie einzuziehen.',
    closeGuide: 'Hinweis schließen', outstanding: 'Offen', includesUnbilled: 'Davon {amount} noch nicht berechnet', collected: 'Eingenommen',
    waived: 'Erlassen', searchPlaceholder: 'Nach Kundenname oder E-Mail suchen...', all: 'Alle', unpaid: 'Offen', paid: 'Bezahlt',
    colCustomer: 'Kunde', colReason: 'Grund', colAmount: 'Betrag', colBilledOn: 'Berechnet am', colStatus: 'Status', colActions: 'Aktionen',
    noFees: 'Keine Gebühren gefunden', unknown: 'Unbekannt', noShow: 'No-Show', lateCancel: 'Späte Absage', updating: 'Gebühr wird aktualisiert…',
    reopen: 'Wieder öffnen', chargeCard: 'Karte belasten', chargeRecorded: 'Belastung erfasst', noSavedCard: 'Keine Karte hinterlegt', markPaid: 'Als bezahlt markieren',
    waive: 'Erlassen', noCardHint: 'Keine Karte hinterlegt: Betrag selbst kassieren, dann „Als bezahlt markieren“.',
    showing: '{shown} von {total} No-Shows', thisCustomer: 'diesen Kunden',
    confirmWaive: '{amount} für {name} erlassen? Die Gebühr wird ohne Zahlung geschlossen.',
    confirmCharge: '{amount} von der hinterlegten Karte von {name} abbuchen?',
    feeAdded: 'Gebühr für {name} angelegt. Jetzt Karte belasten, als bezahlt markieren oder erlassen.',
    markedPaid: 'Gebühr als bezahlt markiert. Sie ist nicht mehr im Action Centre.', markPaidFailed: 'Die Gebühr konnte nicht als bezahlt markiert werden. Bitte erneut versuchen.',
    reopened: 'Gebühr wieder geöffnet und zurück im Action Centre.', reopenFailed: 'Die Gebühr konnte nicht wieder geöffnet werden. Bitte erneut versuchen.',
    feeWaived: 'Gebühr erlassen. Sie ist nicht mehr im Action Centre.', waiveFailed: 'Die Gebühr konnte nicht erlassen werden. Bitte erneut versuchen.',
    cardCharged: 'Karte mit {amount} belastet. Die Gebühr ist erledigt.',
    noCardOnFile: 'Für diese Buchung ist keine Karte hinterlegt. Externe Zahlung erfassen oder Gebühr erlassen.',
    paymentsNotConnected: 'Verbinden Sie Stripe unter Einstellungen → Zahlungen, bevor Sie hinterlegte Karten belasten.',
    noFeeConfigured: 'Für diese Leistung ist keine No-Show-Gebühr mehr eingerichtet.',
    alreadyCharged: 'Diese Buchung wurde bereits belastet. Der Gebührenstatus wird aktualisiert.',
    chargeFailed: 'Die hinterlegte Karte konnte nicht belastet werden. Bitten Sie den Kunden um eine andere Zahlart oder erlassen Sie die Gebühr.',
    chargeFailedGeneric: 'Die hinterlegte Karte konnte nicht belastet werden.',
  },
  th: {
    noBusiness: 'ไม่พบข้อมูลร้านของคุณ กรุณาเข้าสู่ระบบอีกครั้ง', loadFailed: 'โหลดค่าธรรมเนียมไม่มาตามนัดไม่สำเร็จ',
    title: 'ค่าธรรมเนียมไม่มาตามนัด', subtitle: 'เรียกเก็บ บันทึกการชำระ หรือยกเว้นค่าธรรมเนียมแต่ละรายการ รายการที่จัดการแล้วจะออกจาก Action Centre อัตโนมัติ',
    howItWorks: 'ทำงานอย่างไร?', guideTitle: 'วิธีจัดการค่าธรรมเนียมที่ยังไม่ชำระ',
    guideCharge: 'เรียกเก็บจากบัตร', guideChargeBody: 'ตัดเงินจากบัตรที่ลูกค้าบันทึกไว้ตอนจองผ่าน Stripe',
    guideMarkPaid: 'ทำเครื่องหมายว่าชำระแล้ว', guideMarkPaidBody: 'บันทึกเฉพาะเงินที่ได้รับแล้ว (เงินสด โอนเงิน เครื่องรูดบัตร) — ไม่มีการเรียกเก็บเงินจากใคร',
    guideWaive: 'ยกเว้น', guideWaiveBody: 'ปิดค่าธรรมเนียมโดยไม่เรียกเก็บ',
    closeGuide: 'ปิดคำแนะนำ', outstanding: 'ค้างชำระ', includesUnbilled: 'รวม {amount} ที่ยังไม่เรียกเก็บ', collected: 'เก็บได้แล้ว',
    waived: 'ยกเว้นแล้ว', searchPlaceholder: 'ค้นหาด้วยชื่อหรืออีเมลลูกค้า...', all: 'ทั้งหมด', unpaid: 'ยังไม่ชำระ', paid: 'ชำระแล้ว',
    colCustomer: 'ลูกค้า', colReason: 'เหตุผล', colAmount: 'จำนวนเงิน', colBilledOn: 'วันที่เรียกเก็บ', colStatus: 'สถานะ', colActions: 'การดำเนินการ',
    noFees: 'ไม่พบค่าธรรมเนียม', unknown: 'ไม่ทราบชื่อ', noShow: 'ไม่มาตามนัด', lateCancel: 'ยกเลิกกระชั้นชิด', updating: 'กำลังอัปเดตค่าธรรมเนียม…',
    reopen: 'เปิดใหม่', chargeCard: 'เรียกเก็บจากบัตร', chargeRecorded: 'บันทึกการเรียกเก็บแล้ว', noSavedCard: 'ไม่มีบัตรที่บันทึกไว้', markPaid: 'ทำเครื่องหมายว่าชำระแล้ว',
    waive: 'ยกเว้น', noCardHint: 'ไม่มีบัตรที่บันทึกไว้ ให้เก็บเงินเอง แล้วกด “ทำเครื่องหมายว่าชำระแล้ว”',
    showing: 'แสดง {shown} จาก {total} รายการไม่มาตามนัด', thisCustomer: 'ลูกค้ารายนี้',
    confirmWaive: 'ยกเว้น {amount} ให้ {name}? ค่าธรรมเนียมจะถูกปิดโดยไม่บันทึกการชำระ',
    confirmCharge: 'เรียกเก็บ {amount} จากบัตรที่บันทึกไว้ของ {name}?',
    feeAdded: 'เพิ่มค่าธรรมเนียมให้ {name} แล้ว ต่อไปเรียกเก็บจากบัตร ทำเครื่องหมายว่าชำระแล้ว หรือยกเว้น',
    markedPaid: 'ทำเครื่องหมายว่าชำระแล้ว รายการออกจาก Action Centre แล้ว', markPaidFailed: 'ทำเครื่องหมายว่าชำระแล้วไม่สำเร็จ กรุณาลองอีกครั้ง',
    reopened: 'เปิดค่าธรรมเนียมใหม่และกลับไปที่ Action Centre แล้ว', reopenFailed: 'เปิดค่าธรรมเนียมใหม่ไม่สำเร็จ กรุณาลองอีกครั้ง',
    feeWaived: 'ยกเว้นค่าธรรมเนียมแล้ว รายการออกจาก Action Centre แล้ว', waiveFailed: 'ยกเว้นค่าธรรมเนียมไม่สำเร็จ กรุณาลองอีกครั้ง',
    cardCharged: 'เรียกเก็บจากบัตร {amount} แล้ว ค่าธรรมเนียมนี้เสร็จสิ้น',
    noCardOnFile: 'การจองนี้ไม่มีบัตรที่บันทึกไว้ ให้บันทึกการชำระจากช่องทางอื่นหรือยกเว้นค่าธรรมเนียม',
    paymentsNotConnected: 'เชื่อมต่อ Stripe ที่ การตั้งค่า → การชำระเงิน ก่อนเรียกเก็บจากบัตรที่บันทึกไว้',
    noFeeConfigured: 'บริการนี้ไม่ได้ตั้งค่าธรรมเนียมไม่มาตามนัดแล้ว',
    alreadyCharged: 'การจองนี้ถูกเรียกเก็บไปแล้ว กำลังรีเฟรชสถานะค่าธรรมเนียม',
    chargeFailed: 'เรียกเก็บจากบัตรที่บันทึกไว้ไม่สำเร็จ ให้ลูกค้าชำระด้วยวิธีอื่นหรือยกเว้นค่าธรรมเนียม',
    chargeFailedGeneric: 'เรียกเก็บจากบัตรที่บันทึกไว้ไม่สำเร็จ',
  },
};

type NoticeKey = 'feeAdded' | 'markedPaid' | 'markPaidFailed' | 'reopened' | 'reopenFailed' | 'feeWaived' | 'waiveFailed'
  | 'cardCharged' | 'noCardOnFile' | 'paymentsNotConnected' | 'noFeeConfigured' | 'alreadyCharged' | 'chargeFailed' | 'chargeFailedGeneric';

/** A notice is built from a text key at render (so it follows the language), or carries a server message as-is. */
type Notice = { tone: 'success' | 'warning' | 'error' } & ({ key: NoticeKey; values?: Record<string, string> } | { text: string });

const CHARGE_REASON_KEYS: Record<string, NoticeKey> = {
  no_card_on_file: 'noCardOnFile',
  payments_not_connected: 'paymentsNotConnected',
  no_fee_configured: 'noFeeConfigured',
  already_charged: 'alreadyCharged',
  charge_failed: 'chargeFailed',
};


const GUIDE_DISMISSED_KEY = 'zenno.noShowFees.guideDismissed';

const readGuideDismissed = (): boolean => {
  try {
    return localStorage.getItem(GUIDE_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};

const writeGuideDismissed = (isDismissed: boolean) => {
  try {
    if (isDismissed) localStorage.setItem(GUIDE_DISMISSED_KEY, '1');
    else localStorage.removeItem(GUIDE_DISMISSED_KEY);
  } catch {
    // Storage can be unavailable (private mode); the guide simply reappears next visit.
  }
};

interface NoShowFee {
  id: string;
  booking_id: string;
  customer_id: string | null;
  amount: number;
  reason: string;
  charged_at: string;
  paid: boolean;
  paid_at: string | null;
  resolution_status: FeeResolution;
  resolved_at: string | null;
  resolution_note: string | null;
  notes: string | null;
  customer: { name: string; email: string } | null;
  booking: {
    business_id: string;
    stripe_payment_method_id: string | null;
    no_show_fee_charged: boolean;
  } | null;
}

export default function NoShowFeesView() {
  const { formatPrice } = useCurrency();
  const { t, locale } = useAdminText(TEXT);
  const adminUser = adminAuth.getCurrentUser();
  const businessId = adminUser?.business_id || null;
  const [fees, setFees] = useState<NoShowFee[]>([]);
  const [filteredFees, setFilteredFees] = useState<NoShowFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'noBusiness' | 'loadFailed' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | FeeResolution>('unpaid');
  const [activeFeeId, setActiveFeeId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [unbilled, setUnbilled] = useState<UnbilledNoShowRow[]>([]);
  const [isGuideDismissed, setIsGuideDismissed] = useState(readGuideDismissed);

  const toggleGuide = (isDismissed: boolean) => {
    setIsGuideDismissed(isDismissed);
    writeGuideDismissed(isDismissed);
  };

  useEffect(() => {
    fetchFees();
  }, [businessId]);

  useEffect(() => {
    filterFees();
  }, [searchTerm, statusFilter, fees]);

  const fetchFees = async () => {
    if (!businessId) {
      setError('noBusiness');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    await fetchUnbilled(businessId);

    const { data, error: fetchError } = await supabase
      .from('no_show_fees')
      .select(`
        *,
        customer:customers(name, email),
        booking:bookings!inner(business_id, stripe_payment_method_id, no_show_fee_charged)
      `)
      .eq('booking.business_id', businessId)
      .order('charged_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching no-show fees:', fetchError);
      setError('loadFailed');
    } else {
      const normalizedFees = (data || []).map((row) => ({
        ...row,
        customer: Array.isArray(row.customer) ? row.customer[0] || null : row.customer,
        booking: Array.isArray(row.booking) ? row.booking[0] || null : row.booking,
      })) as NoShowFee[];
      setFees(normalizedFees);
    }
    setLoading(false);
  };

  // No-shows are the source of truth: any no-show whose service carries a fee
  // but has no fee record yet is shown here too, so this list matches the
  // repeat no-show analytics above.
  const fetchUnbilled = async (targetBusinessId: string) => {
    const { data, error: unbilledError } = await supabase
      .from('bookings')
      .select('id, customer_name, customer_email, booking_date, start_time, service:services(name, no_show_fee), fees:no_show_fees(id)')
      .eq('business_id', targetBusinessId)
      .eq('no_show', true)
      .order('booking_date', { ascending: false });

    if (unbilledError) {
      console.error('Error fetching unbilled no-shows:', unbilledError);
      setUnbilled([]);
      return;
    }

    type Row = {
      id: string; customer_name: string; customer_email: string; booking_date: string; start_time: string;
      service: { name: string; no_show_fee: number | null } | { name: string; no_show_fee: number | null }[] | null;
      fees: { id: string } | { id: string }[] | null;
    };
    const first = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? value[0] ?? null : value);
    const rows = ((data || []) as unknown as Row[])
      .filter((row) => !first(row.fees) && Number(first(row.service)?.no_show_fee || 0) > 0)
      .map((row) => ({
        id: row.id,
        customer_name: row.customer_name,
        customer_email: row.customer_email,
        booking_date: row.booking_date,
        start_time: row.start_time,
        serviceName: first(row.service)?.name || 'appointment',
        feeCents: Number(first(row.service)?.no_show_fee || 0),
      }));
    setUnbilled(rows);
  };

  const addFee = async (row: UnbilledNoShowRow) => {
    if (!businessId) return;
    setActiveFeeId(row.id);
    setNotice(null);
    const { error: addError } = await createUnpaidNoShowFees(businessId, [row]);
    if (addError) {
      setNotice({ tone: 'error', text: addError });
    } else {
      setNotice({ tone: 'success', key: 'feeAdded', values: { name: row.customer_name } });
      await fetchFees();
    }
    setActiveFeeId(null);
  };

  const filterFees = () => {
    let filtered = fees;

    if (searchTerm) {
      filtered = filtered.filter(
        (f) =>
          f.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          f.customer?.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((f) => f.resolution_status === statusFilter);
    }

    setFilteredFees(filtered);
  };

  const markAsPaid = async (feeId: string) => {
    setActiveFeeId(feeId);
    setNotice(null);
    const resolvedAt = new Date().toISOString();
    const { error } = await supabase
      .from('no_show_fees')
      .update({
        paid: true,
        paid_at: resolvedAt,
        resolution_status: 'paid',
        resolved_at: resolvedAt,
        resolution_note: 'Marked paid manually',
      })
      .eq('id', feeId);

    if (!error) {
      setNotice({ tone: 'success', key: 'markedPaid' });
      await fetchFees();
    } else {
      setNotice({ tone: 'error', key: 'markPaidFailed' });
    }
    setActiveFeeId(null);
  };

  const reopenFee = async (feeId: string) => {
    setActiveFeeId(feeId);
    setNotice(null);
    const { error } = await supabase
      .from('no_show_fees')
      .update({
        paid: false,
        paid_at: null,
        resolution_status: 'unpaid',
        resolved_at: null,
        resolution_note: null,
      })
      .eq('id', feeId);

    if (!error) {
      setNotice({ tone: 'warning', key: 'reopened' });
      await fetchFees();
    } else {
      setNotice({ tone: 'error', key: 'reopenFailed' });
    }
    setActiveFeeId(null);
  };

  const waiveFee = async (fee: NoShowFee) => {
    if (!confirm(fillText(t.confirmWaive, { amount: formatPrice(fee.amount), name: fee.customer?.name || t.thisCustomer }))) return;

    setActiveFeeId(fee.id);
    setNotice(null);
    const resolvedAt = new Date().toISOString();
    const { error } = await supabase
      .from('no_show_fees')
      .update({
        paid: false,
        paid_at: null,
        resolution_status: 'waived',
        resolved_at: resolvedAt,
        resolution_note: 'Waived by staff',
      })
      .eq('id', fee.id);

    if (!error) {
      setNotice({ tone: 'success', key: 'feeWaived' });
      await fetchFees();
    } else {
      setNotice({ tone: 'error', key: 'waiveFailed' });
    }
    setActiveFeeId(null);
  };

  const chargeSavedCard = async (fee: NoShowFee) => {
    if (!fee.booking?.stripe_payment_method_id) {
      setNotice({ tone: 'warning', key: 'noCardOnFile' });
      return;
    }

    if (!confirm(fillText(t.confirmCharge, { amount: formatPrice(fee.amount), name: fee.customer?.name || t.thisCustomer }))) return;

    setActiveFeeId(fee.id);
    setNotice(null);
    const { data, error } = await supabase.functions.invoke('charge-no-show-fee', {
      body: { booking_id: fee.booking_id },
    });

    if (!error && data?.charged) {
      setNotice({ tone: 'success', key: 'cardCharged', values: { amount: formatPrice(Number(data.amount) || fee.amount) } });
      await fetchFees();
      setActiveFeeId(null);
      return;
    }

    const tone = data?.reason === 'charge_failed' || error ? 'error' : 'warning';
    const reasonKey = CHARGE_REASON_KEYS[data?.reason];
    if (reasonKey) setNotice({ tone, key: reasonKey });
    else if (error?.message) setNotice({ tone, text: error.message });
    else setNotice({ tone, key: 'chargeFailedGeneric' });
    await fetchFees();
    setActiveFeeId(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };



  const getTotalUnbilled = () => unbilled.reduce((sum, row) => sum + row.feeCents, 0);

  const getTotalUnpaid = () => {
    return fees.filter((f) => f.resolution_status === 'unpaid').reduce((sum, f) => sum + f.amount, 0) + getTotalUnbilled();
  };

  const getTotalPaid = () => {
    return fees.filter((f) => f.resolution_status === 'paid').reduce((sum, f) => sum + f.amount, 0);
  };

  const getTotalWaived = () => {
    return fees.filter((f) => f.resolution_status === 'waived').reduce((sum, f) => sum + f.amount, 0);
  };

  const showUnbilled = statusFilter === 'all' || statusFilter === 'unpaid';
  const visibleUnbilled = searchTerm
    ? unbilled.filter((row) =>
        row.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.customer_email.toLowerCase().includes(searchTerm.toLowerCase()))
    : unbilled;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-red-200/80 bg-red-50/70 p-4 text-red-700">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm">{t[error]}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1714] mb-1">{t.title}</h1>
          <p className="text-sm text-stone-500">{t.subtitle}</p>
        </div>
        {isGuideDismissed && (
          <button type="button" onClick={() => toggleGuide(false)} className={`${ADMIN_TERTIARY_BUTTON} text-xs`}>
            <HelpCircle className="h-3.5 w-3.5" />
            {t.howItWorks}
          </button>
        )}
      </div>

      {!isGuideDismissed && (
        <section className="relative grid gap-3 rounded-2xl border border-white/70 bg-white/[0.64] p-4 pr-12 shadow-[0_2px_18px_rgba(26,23,20,0.045)] backdrop-blur-xl md:grid-cols-[auto_1fr]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-900/[0.06] text-stone-700">
            <HelpCircle className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1A1714]">{t.guideTitle}</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-stone-500">
              <span className="font-medium text-stone-700">{t.guideCharge}</span> {t.guideChargeBody}{' '}
              <span className="font-medium text-stone-700">{t.guideMarkPaid}</span> {t.guideMarkPaidBody}{' '}
              <span className="font-medium text-stone-700">{t.guideWaive}</span> {t.guideWaiveBody}
            </p>
          </div>
          <button
            type="button"
            onClick={() => toggleGuide(true)}
            aria-label={t.closeGuide}
            className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-900/[0.05] hover:text-stone-700"
          >
            <X className="h-4 w-4" />
          </button>
        </section>
      )}

      {notice && (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm ${
            notice.tone === 'success'
              ? 'border-emerald-200/80 bg-emerald-50/75 text-emerald-800'
              : notice.tone === 'warning'
                ? 'border-amber-200/80 bg-amber-50/75 text-amber-800'
                : 'border-red-200/80 bg-red-50/75 text-red-700'
          }`}
        >
          {'key' in notice ? fillText(t[notice.key], notice.values ?? {}) : notice.text}
        </div>
      )}

      <NoShowAnalytics businessId={businessId!} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className={`${ADMIN_SURFACE_INTERACTIVE} p-5`}>
          <div className="flex items-start justify-between mb-4">
            <span className="text-[13px] font-medium text-stone-500">{t.outstanding}</span>
            <div className={ADMIN_ICON_TILE}>
              <DollarSign className="h-5 w-5" strokeWidth={1.75} />
            </div>
          </div>
          <div className="text-3xl font-semibold tracking-tight text-[#1A1714] tabular-nums">{formatPrice(getTotalUnpaid())}</div>
          {unbilled.length > 0 && (
            <p className="mt-1 text-xs text-amber-700">{fillText(t.includesUnbilled, { amount: formatPrice(getTotalUnbilled()) })}</p>
          )}
        </div>

        <div className={`${ADMIN_SURFACE_INTERACTIVE} p-5`}>
          <div className="flex items-start justify-between mb-4">
            <span className="text-[13px] font-medium text-stone-500">{t.collected}</span>
            <div className={ADMIN_ICON_TILE}>
              <Check className="h-5 w-5" strokeWidth={1.75} />
            </div>
          </div>
          <div className="text-3xl font-semibold tracking-tight text-[#1A1714] tabular-nums">{formatPrice(getTotalPaid())}</div>
        </div>

        <div className={`${ADMIN_SURFACE_INTERACTIVE} p-5`}>
          <div className="flex items-start justify-between mb-4">
            <span className="text-[13px] font-medium text-stone-500">{t.waived}</span>
            <div className={ADMIN_ICON_TILE}>
              <DollarSign className="h-5 w-5" strokeWidth={1.75} />
            </div>
          </div>
          <div className="text-3xl font-semibold tracking-tight text-[#1A1714] tabular-nums">{formatPrice(getTotalWaived())}</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`${ADMIN_INPUT} pl-10`}
          />
        </div>
        <div className={ADMIN_SEGMENTED_CONTROL}>
          <button
            onClick={() => setStatusFilter('all')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === 'all'
                ? ADMIN_SEGMENT_ACTIVE
                : ADMIN_SEGMENT_INACTIVE
            }`}
          >
            {t.all}
          </button>
          <button
            onClick={() => setStatusFilter('unpaid')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === 'unpaid'
                ? ADMIN_SEGMENT_ACTIVE
                : ADMIN_SEGMENT_INACTIVE
            }`}
          >
            {t.unpaid}
          </button>
          <button
            onClick={() => setStatusFilter('paid')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === 'paid'
                ? ADMIN_SEGMENT_ACTIVE
                : ADMIN_SEGMENT_INACTIVE
            }`}
          >
            {t.paid}
          </button>
          <button
            onClick={() => setStatusFilter('waived')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === 'waived'
                ? ADMIN_SEGMENT_ACTIVE
                : ADMIN_SEGMENT_INACTIVE
            }`}
          >
            {t.waived}
          </button>
        </div>
      </div>

      <div className={`${ADMIN_SURFACE} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50/60 border-b border-stone-200/70">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  {t.colCustomer}
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  {t.colReason}
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  {t.colAmount}
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  {t.colBilledOn}
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  {t.colStatus}
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  {t.colActions}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {showUnbilled && (
                <UnbilledNoShowRows
                  rows={visibleUnbilled}
                  activeId={activeFeeId}
                  formatPrice={formatPrice}
                  formatDate={formatDate}
                  onAddFee={addFee}
                />
              )}
              {filteredFees.length === 0 && !(showUnbilled && visibleUnbilled.length > 0) ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-stone-500">
                    {t.noFees}
                  </td>
                </tr>
              ) : filteredFees.length === 0 ? null : (
                filteredFees.map((fee) => (
                  <tr key={fee.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm text-stone-800 font-medium">
                        {fee.customer?.name || t.unknown}
                      </div>
                      <div className="text-xs text-stone-500">{fee.customer?.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`${ADMIN_STATUS_PILL} ${
                          fee.reason === 'no_show'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {fee.reason === 'no_show' ? t.noShow : t.lateCancel}
                      </span>
                      {fee.notes && (
                        <div className="text-xs text-stone-500 mt-1">{fee.notes}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-800 font-medium">
                      {formatPrice(fee.amount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-500">
                      {formatDate(fee.charged_at)}
                    </td>
                    <td className="px-6 py-4">
                      {fee.resolution_status === 'paid' ? (
                        <div>
                          <span className={`${ADMIN_STATUS_PILL} bg-emerald-50 text-emerald-700`}>
                            {t.paid}
                          </span>
                          {fee.paid_at && (
                            <div className="text-xs text-stone-500 mt-1">
                              {formatDate(fee.paid_at)}
                            </div>
                          )}
                        </div>
                      ) : fee.resolution_status === 'waived' ? (
                        <div>
                          <span className={`${ADMIN_STATUS_PILL} bg-stone-100 text-stone-600`}>
                            {t.waived}
                          </span>
                          {fee.resolved_at && (
                            <div className="mt-1 text-xs text-stone-500">{formatDate(fee.resolved_at)}</div>
                          )}
                        </div>
                      ) : (
                        <span className={`${ADMIN_STATUS_PILL} bg-amber-50 text-amber-700`}>
                          {t.unpaid}
                        </span>
                      )}
                    </td>
                    <td className="min-w-[310px] px-6 py-4">
                      {activeFeeId === fee.id ? (
                        <div className="flex items-center gap-2 text-sm text-stone-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t.updating}
                        </div>
                      ) : fee.resolution_status !== 'unpaid' ? (
                        <button
                          type="button"
                          onClick={() => reopenFee(fee.id)}
                          className={ADMIN_TERTIARY_BUTTON}
                        >
                          <RotateCcw className="h-4 w-4" />
                          {t.reopen}
                        </button>
                      ) : (
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            {fee.booking?.stripe_payment_method_id && !fee.booking.no_show_fee_charged ? (
                              <button
                                type="button"
                                onClick={() => chargeSavedCard(fee)}
                                className={`${ADMIN_PRIMARY_BUTTON} px-3 py-2 text-xs`}
                              >
                                <CreditCard className="h-3.5 w-3.5" />
                                {t.chargeCard}
                              </button>
                            ) : (
                              <span className="rounded-lg bg-stone-100 px-2.5 py-2 text-xs text-stone-500">
                                {fee.booking?.no_show_fee_charged ? t.chargeRecorded : t.noSavedCard}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => markAsPaid(fee.id)}
                              className={`${ADMIN_SECONDARY_BUTTON} px-3 py-2 text-xs`}
                            >
                              <Check className="h-3.5 w-3.5" />
                              {t.markPaid}
                            </button>
                            <button
                              type="button"
                              onClick={() => waiveFee(fee)}
                              className={`${ADMIN_TERTIARY_BUTTON} px-2.5 py-2 text-xs`}
                            >
                              <Ban className="h-3.5 w-3.5" />
                              {t.waive}
                            </button>
                          </div>
                          {!fee.booking?.stripe_payment_method_id && !fee.booking?.no_show_fee_charged && (
                            <p className="mt-2 text-[11px] leading-4 text-stone-400">{t.noCardHint}</p>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-stone-400">
        {fillText(t.showing, { shown: filteredFees.length + (showUnbilled ? visibleUnbilled.length : 0), total: fees.length + unbilled.length })}
      </div>
    </div>
  );
}
