import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Check,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Link2,
  LockKeyhole,
  RefreshCw,
  Save,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../lib/tenantContext';
import { adminAuth } from '../../../lib/adminAuth';
import { useAdminText } from '../../../lib/adminLanguage';
import type { Translations } from '../../../lib/bookingLanguage';
import {
  ADMIN_ICON_TILE,
  ADMIN_INPUT,
  ADMIN_PRIMARY_BUTTON,
  ADMIN_SECONDARY_BUTTON,
  ADMIN_SELECT,
  ADMIN_STATUS_PILL,
} from '../adminUi';

interface BusinessConnectData {
  stripe_connect_account_id: string | null;
  stripe_connect_onboarding_complete: boolean;
  stripe_connect_charges_enabled: boolean;
  stripe_connect_payouts_enabled: boolean;
  stripe_connect_country: string | null;
  platform_fee_percentage: number;
}

interface Notice {
  tone: 'success' | 'error';
  text: string;
}

const PAYMENT_SETTING_KEYS = [
  'stripe_enabled',
  'allow_pay_in_person',
  'paypal_enabled',
  'paypal_client_id',
  'paypal_secret',
];

function readSettingValue(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function Switch({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label className={`relative inline-flex shrink-0 items-center ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <span className="sr-only">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="peer sr-only"
      />
      <span className="h-6 w-11 rounded-full bg-stone-200 ring-1 ring-stone-900/[0.06] transition peer-focus-visible:ring-4 peer-focus-visible:ring-stone-900/10 peer-checked:bg-[#1A1714] peer-checked:after:translate-x-5 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition" />
    </label>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof CreditCard;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={ADMIN_ICON_TILE}>
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight text-[#1A1714]">{title}</h3>
        <p className="mt-0.5 max-w-2xl text-sm leading-6 text-stone-500">{description}</p>
      </div>
    </div>
  );
}

type PaymentSettingsText = {
  verified: string; verifyFailed: string; loadFailed: string; onboardingFailed: string; saved: string; saveFailed: string;
  ownerRequired: string; ownerRequiredHint: string; title: string; ownerOnly: string; subtitle: string; saving: string;
  saveChanges: string; stripeTitle: string; stripeDescription: string; stripeConnected: string; account: string;
  country: string; zennoFee: string; chargesEnabled: string; payoutsEnabled: string; refreshStatus: string;
  acceptCards: string; acceptCardsHint: string; setupUnfinished: string; setupUnfinishedHint: string;
  openingStripe: string; continueInStripe: string; connectTitle: string; connectHint: string; connectStripe: string;
  registeredCountry: string; countryDE: string; countryAT: string; countryBE: string; countryFR: string;
  countryNL: string; countryES: string; countryIT: string; countryUS: string; payInShopTitle: string;
  payInShopDescription: string; showPayInShop: string; showPayInShopHint: string; allowPayInShop: string;
  paypalDescription: string; acceptPaypal: string; acceptPaypalHint: string; paypalClientId: string;
  paypalSecret: string; openPaypalDashboard: string;
};

const TEXT: Translations<PaymentSettingsText> = {
  en: {
    verified: 'Stripe connection verified.', verifyFailed: 'We could not verify the Stripe connection. Try again.',
    loadFailed: 'Payment settings could not be loaded.', onboardingFailed: 'Stripe onboarding could not be started. Try again.',
    saved: 'Payment settings saved.', saveFailed: 'Payment settings could not be saved.',
    ownerRequired: 'Owner access required',
    ownerRequiredHint: 'Payment connections affect payouts and customer charges, so only the business owner can change them.',
    title: 'Payments', ownerOnly: 'Owner only',
    subtitle: 'Connect payouts, choose checkout methods, and control how card guarantees work.',
    saving: 'Saving…', saveChanges: 'Save changes', stripeTitle: 'Stripe payouts',
    stripeDescription: "The owner completes Stripe's hosted verification. Zenno never asks your team to paste a Stripe secret key.",
    stripeConnected: 'Stripe is connected', account: 'Account', country: 'Country', zennoFee: 'Zenno fee',
    chargesEnabled: 'Charges enabled', payoutsEnabled: 'Payouts enabled', refreshStatus: 'Refresh status',
    acceptCards: 'Accept online card payments', acceptCardsHint: 'Pause checkout without disconnecting payouts.',
    setupUnfinished: 'Stripe setup is not finished',
    setupUnfinishedHint: 'Continue the hosted onboarding to enable charges and payouts for this business.',
    openingStripe: 'Opening Stripe…', continueInStripe: 'Continue in Stripe',
    connectTitle: "Connect the business owner's Stripe account",
    connectHint: 'Stripe handles identity checks and bank details. Zenno receives only the connected account ID needed to route payments and no-show fees.',
    connectStripe: 'Connect Stripe', registeredCountry: 'Registered country',
    countryDE: 'Germany', countryAT: 'Austria', countryBE: 'Belgium', countryFR: 'France',
    countryNL: 'Netherlands', countryES: 'Spain', countryIT: 'Italy', countryUS: 'United States',
    payInShopTitle: 'Pay at venue',
    payInShopDescription: 'Offer in-person payment while still protecting eligible appointments with a card guarantee.',
    showPayInShop: 'Show “Pay at venue” at checkout',
    showPayInShopHint: 'If a service has a no-show fee, Zenno can save a card guarantee without charging the appointment amount.',
    allowPayInShop: 'Allow pay at venue',
    paypalDescription: 'Optional checkout method. Credentials can only be viewed and changed by the business owner.',
    acceptPaypal: 'Accept PayPal', acceptPaypalHint: 'Customers can pay from their PayPal account at checkout.',
    paypalClientId: 'PayPal client ID', paypalSecret: 'PayPal secret', openPaypalDashboard: 'Open PayPal developer dashboard',
  },
  de: {
    verified: 'Stripe-Verbindung bestätigt.', verifyFailed: 'Die Stripe-Verbindung konnte nicht geprüft werden. Bitte erneut versuchen.',
    loadFailed: 'Zahlungseinstellungen konnten nicht geladen werden.', onboardingFailed: 'Die Stripe-Einrichtung konnte nicht gestartet werden. Bitte erneut versuchen.',
    saved: 'Zahlungseinstellungen gespeichert.', saveFailed: 'Zahlungseinstellungen konnten nicht gespeichert werden.',
    ownerRequired: 'Nur für Inhaber',
    ownerRequiredHint: 'Zahlungsverbindungen betreffen Auszahlungen und Kundenzahlungen. Daher kann nur der Inhaber sie ändern.',
    title: 'Zahlungen', ownerOnly: 'Nur Inhaber',
    subtitle: 'Auszahlungen verbinden, Zahlarten auswählen und Kartengarantien steuern.',
    saving: 'Wird gespeichert…', saveChanges: 'Änderungen speichern', stripeTitle: 'Stripe-Auszahlungen',
    stripeDescription: 'Der Inhaber schließt die Verifizierung direkt bei Stripe ab. Zenno fragt Ihr Team nie nach einem geheimen Stripe-Schlüssel.',
    stripeConnected: 'Stripe ist verbunden', account: 'Konto', country: 'Land', zennoFee: 'Zenno-Gebühr',
    chargesEnabled: 'Zahlungen aktiv', payoutsEnabled: 'Auszahlungen aktiv', refreshStatus: 'Status aktualisieren',
    acceptCards: 'Online-Kartenzahlungen annehmen', acceptCardsHint: 'Online-Zahlung pausieren, ohne Auszahlungen zu trennen.',
    setupUnfinished: 'Stripe-Einrichtung nicht abgeschlossen',
    setupUnfinishedHint: 'Einrichtung bei Stripe fortsetzen, um Zahlungen und Auszahlungen für dieses Geschäft zu aktivieren.',
    openingStripe: 'Stripe wird geöffnet…', continueInStripe: 'Bei Stripe fortfahren',
    connectTitle: 'Stripe-Konto des Inhabers verbinden',
    connectHint: 'Stripe übernimmt Identitätsprüfung und Bankdaten. Zenno erhält nur die Konto-ID, die zum Weiterleiten von Zahlungen und No-Show-Gebühren nötig ist.',
    connectStripe: 'Stripe verbinden', registeredCountry: 'Land der Registrierung',
    countryDE: 'Deutschland', countryAT: 'Österreich', countryBE: 'Belgien', countryFR: 'Frankreich',
    countryNL: 'Niederlande', countryES: 'Spanien', countryIT: 'Italien', countryUS: 'Vereinigte Staaten',
    payInShopTitle: 'Zahlung vor Ort',
    payInShopDescription: 'Zahlung vor Ort anbieten und passende Termine trotzdem mit einer Kartengarantie absichern.',
    showPayInShop: '„Zahlung vor Ort“ beim Bezahlen anzeigen',
    showPayInShopHint: 'Hat eine Leistung eine No-Show-Gebühr, kann Zenno eine Kartengarantie speichern, ohne den Terminbetrag abzubuchen.',
    allowPayInShop: 'Zahlung vor Ort erlauben',
    paypalDescription: 'Optionale Zahlart. Zugangsdaten kann nur der Inhaber einsehen und ändern.',
    acceptPaypal: 'PayPal annehmen', acceptPaypalHint: 'Kunden können beim Bezahlen ihr PayPal-Konto nutzen.',
    paypalClientId: 'PayPal-Client-ID', paypalSecret: 'PayPal-Secret', openPaypalDashboard: 'PayPal-Entwickler-Dashboard öffnen',
  },
  th: {
    verified: 'ยืนยันการเชื่อมต่อ Stripe แล้ว', verifyFailed: 'ตรวจสอบการเชื่อมต่อ Stripe ไม่สำเร็จ กรุณาลองอีกครั้ง',
    loadFailed: 'โหลดการตั้งค่าการชำระเงินไม่สำเร็จ', onboardingFailed: 'เริ่มการตั้งค่า Stripe ไม่สำเร็จ กรุณาลองอีกครั้ง',
    saved: 'บันทึกการตั้งค่าการชำระเงินแล้ว', saveFailed: 'บันทึกการตั้งค่าการชำระเงินไม่สำเร็จ',
    ownerRequired: 'เฉพาะเจ้าของร้าน',
    ownerRequiredHint: 'การเชื่อมต่อการชำระเงินมีผลต่อการรับเงินและการเรียกเก็บเงินจากลูกค้า จึงให้เฉพาะเจ้าของร้านเปลี่ยนได้',
    title: 'การชำระเงิน', ownerOnly: 'เฉพาะเจ้าของ',
    subtitle: 'เชื่อมต่อการรับเงิน เลือกวิธีชำระเงิน และกำหนดการค้ำประกันด้วยบัตร',
    saving: 'กำลังบันทึก…', saveChanges: 'บันทึกการเปลี่ยนแปลง', stripeTitle: 'การรับเงินผ่าน Stripe',
    stripeDescription: 'เจ้าของร้านยืนยันตัวตนบนหน้าของ Stripe โดยตรง Zenno ไม่เคยขอให้ทีมของคุณวาง Secret Key ของ Stripe',
    stripeConnected: 'เชื่อมต่อ Stripe แล้ว', account: 'บัญชี', country: 'ประเทศ', zennoFee: 'ค่าธรรมเนียม Zenno',
    chargesEnabled: 'รับชำระเงินได้', payoutsEnabled: 'รับเงินโอนได้', refreshStatus: 'อัปเดตสถานะ',
    acceptCards: 'รับชำระด้วยบัตรออนไลน์', acceptCardsHint: 'หยุดรับชำระออนไลน์ชั่วคราวโดยไม่ตัดการรับเงิน',
    setupUnfinished: 'ตั้งค่า Stripe ยังไม่เสร็จ',
    setupUnfinishedHint: 'ทำขั้นตอนบน Stripe ต่อเพื่อเปิดการรับชำระและการรับเงินของร้านนี้',
    openingStripe: 'กำลังเปิด Stripe…', continueInStripe: 'ทำต่อใน Stripe',
    connectTitle: 'เชื่อมต่อบัญชี Stripe ของเจ้าของร้าน',
    connectHint: 'Stripe ดูแลการยืนยันตัวตนและข้อมูลธนาคาร Zenno ได้รับเพียงรหัสบัญชีที่ใช้ส่งต่อการชำระเงินและค่าปรับกรณีไม่มาตามนัด',
    connectStripe: 'เชื่อมต่อ Stripe', registeredCountry: 'ประเทศที่จดทะเบียน',
    countryDE: 'เยอรมนี', countryAT: 'ออสเตรีย', countryBE: 'เบลเยียม', countryFR: 'ฝรั่งเศส',
    countryNL: 'เนเธอร์แลนด์', countryES: 'สเปน', countryIT: 'อิตาลี', countryUS: 'สหรัฐอเมริกา',
    payInShopTitle: 'ชำระที่ร้าน',
    payInShopDescription: 'เปิดให้ชำระที่ร้าน และยังคุ้มครองนัดหมายที่เข้าเงื่อนไขด้วยการค้ำประกันด้วยบัตร',
    showPayInShop: 'แสดงตัวเลือก “ชำระที่ร้าน” ตอนชำระเงิน',
    showPayInShopHint: 'หากบริการมีค่าปรับกรณีไม่มาตามนัด Zenno จะบันทึกบัตรไว้ค้ำประกันโดยไม่เรียกเก็บค่านัดหมาย',
    allowPayInShop: 'อนุญาตให้ชำระที่ร้าน',
    paypalDescription: 'วิธีชำระเงินเพิ่มเติม (ไม่บังคับ) เฉพาะเจ้าของร้านดูและแก้ไขข้อมูลเข้าสู่ระบบได้',
    acceptPaypal: 'รับชำระผ่าน PayPal', acceptPaypalHint: 'ลูกค้าชำระด้วยบัญชี PayPal ได้ตอนชำระเงิน',
    paypalClientId: 'PayPal Client ID', paypalSecret: 'PayPal Secret', openPaypalDashboard: 'เปิดแดชบอร์ดนักพัฒนา PayPal',
  },
};

export default function PaymentSettings() {
  const { t } = useAdminText(TEXT);
  const textRef = useRef(t);
  textRef.current = t;
  const { businessId } = useTenant();
  const currentUser = adminAuth.getCurrentUser();
  const isOwner = currentUser?.role === 'owner';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [allowPayInPerson, setAllowPayInPerson] = useState(false);
  const [connectData, setConnectData] = useState<BusinessConnectData | null>(null);
  const [selectedCountry, setSelectedCountry] = useState('DE');
  const [connectingToStripe, setConnectingToStripe] = useState(false);
  const [paypalEnabled, setPaypalEnabled] = useState(false);
  const [paypalClientId, setPaypalClientId] = useState('');
  const [paypalSecret, setPaypalSecret] = useState('');

  const fetchSettings = async () => {
    if (!businessId) return;

    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')
      .eq('business_id', businessId)
      .in('key', PAYMENT_SETTING_KEYS);

    if (error) throw error;

    data?.forEach((setting) => {
      const value = readSettingValue(setting.value);
      if (setting.key === 'stripe_enabled') setStripeEnabled(value === true || value === 'true');
      if (setting.key === 'allow_pay_in_person') setAllowPayInPerson(value === true || value === 'true');
      if (setting.key === 'paypal_enabled') setPaypalEnabled(value === true || value === 'true');
      if (setting.key === 'paypal_client_id') setPaypalClientId(typeof value === 'string' ? value : '');
      if (setting.key === 'paypal_secret') setPaypalSecret(typeof value === 'string' ? value : '');
    });
  };

  const fetchConnectData = async () => {
    if (!businessId) return;

    const { data, error } = await supabase
      .from('businesses')
      .select('stripe_connect_account_id, stripe_connect_onboarding_complete, stripe_connect_charges_enabled, stripe_connect_payouts_enabled, stripe_connect_country, platform_fee_percentage')
      .eq('id', businessId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return;

    setConnectData(data);
    if (data.stripe_connect_country) setSelectedCountry(data.stripe_connect_country);
  };

  const refreshPaymentData = async () => {
    await Promise.all([fetchSettings(), fetchConnectData()]);
  };

  const handleVerifyConnection = async () => {
    if (!businessId || !isOwner) return;

    setConnectingToStripe(true);
    setNotice(null);
    try {
      const { data, error } = await supabase.functions.invoke('verify-connect-account', {
        body: {},
      });

      if (error) throw error;
      await refreshPaymentData();
      if (data?.onboardingComplete) setStripeEnabled(true);
      setNotice({ tone: 'success', text: textRef.current.verified });
    } catch (error) {
      console.error('Error verifying Stripe connection:', error);
      setNotice({ tone: 'error', text: textRef.current.verifyFailed });
    } finally {
      setConnectingToStripe(false);
    }
  };

  useEffect(() => {
    if (!businessId || !isOwner) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        await refreshPaymentData();

        const params = new URLSearchParams(window.location.search);
        if (params.has('connect_return') || params.has('connect_refresh')) {
          await handleVerifyConnection();
          window.history.replaceState({}, document.title, '/admin?view=settings&tab=payment');
        }
      } catch (error) {
        console.error('Error loading payment settings:', error);
        setNotice({ tone: 'error', text: textRef.current.loadFailed });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [businessId, isOwner]);

  const handleConnectToStripe = async () => {
    if (!businessId || !isOwner) return;

    setConnectingToStripe(true);
    setNotice(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-connect-account-link', {
        body: { country: selectedCountry, accountType: 'standard' },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('Stripe did not return an onboarding link');
      window.location.assign(data.url);
    } catch (error) {
      console.error('Error connecting to Stripe:', error);
      setNotice({ tone: 'error', text: t.onboardingFailed });
      setConnectingToStripe(false);
    }
  };

  const handleSave = async () => {
    if (!businessId || !isOwner) return;

    setSaving(true);
    setNotice(null);
    try {
      const updates = [
        { key: 'stripe_enabled', value: JSON.stringify(stripeEnabled) },
        { key: 'allow_pay_in_person', value: JSON.stringify(allowPayInPerson) },
        { key: 'paypal_enabled', value: JSON.stringify(paypalEnabled) },
        { key: 'paypal_client_id', value: paypalClientId.trim() },
        { key: 'paypal_secret', value: paypalSecret.trim() },
      ].map((setting) => ({
        ...setting,
        business_id: businessId,
        category: 'payment',
      }));

      const { error } = await supabase
        .from('site_settings')
        .upsert(updates, { onConflict: 'business_id,key' });

      if (error) throw error;
      setNotice({ tone: 'success', text: t.saved });
    } catch (error) {
      console.error('Error saving payment settings:', error);
      setNotice({ tone: 'error', text: t.saveFailed });
    } finally {
      setSaving(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center text-center">
        <div className={`${ADMIN_ICON_TILE} mb-4`}>
          <LockKeyhole className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <h3 className="text-base font-semibold text-[#1A1714]">{t.ownerRequired}</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-stone-500">
          {t.ownerRequiredHint}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-16 rounded-2xl bg-stone-900/[0.04]" />
        <div className="h-56 rounded-2xl bg-stone-900/[0.04]" />
        <div className="h-36 rounded-2xl bg-stone-900/[0.04]" />
      </div>
    );
  }

  const stripeConnected = Boolean(connectData?.stripe_connect_onboarding_complete);
  const accountLabel = connectData?.stripe_connect_account_id
    ? `${connectData.stripe_connect_account_id.slice(0, 8)}…${connectData.stripe_connect_account_id.slice(-4)}`
    : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-[#1A1714]">{t.title}</h2>
            <span className={`${ADMIN_STATUS_PILL} bg-stone-900/[0.06] text-stone-600`}>
              <ShieldCheck className="h-3.5 w-3.5" />
              {t.ownerOnly}
            </span>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-stone-500">
            {t.subtitle}
          </p>
        </div>
        <button type="button" onClick={handleSave} disabled={saving} className={ADMIN_PRIMARY_BUTTON}>
          <Save className="h-4 w-4" />
          {saving ? t.saving : t.saveChanges}
        </button>
      </div>

      {notice && (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${
            notice.tone === 'success'
              ? 'border-emerald-200/80 bg-emerald-50/70 text-emerald-800'
              : 'border-red-200/80 bg-red-50/70 text-red-800'
          }`}
        >
          {notice.tone === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {notice.text}
        </div>
      )}

      <section className="space-y-5 border-b border-stone-200/70 pb-8">
        <SectionHeading
          icon={Link2}
          title={t.stripeTitle}
          description={t.stripeDescription}
        />

        {stripeConnected ? (
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-5">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                  <p className="font-semibold text-emerald-950">{t.stripeConnected}</p>
                </div>
                <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-emerald-800/60">{t.account}</dt>
                    <dd className="mt-0.5 font-medium text-emerald-950 tabular-nums">{accountLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-emerald-800/60">{t.country}</dt>
                    <dd className="mt-0.5 font-medium text-emerald-950">{connectData?.stripe_connect_country || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-emerald-800/60">{t.zennoFee}</dt>
                    <dd className="mt-0.5 font-medium text-emerald-950 tabular-nums">
                      {connectData?.platform_fee_percentage ?? 2.5}%
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`${ADMIN_STATUS_PILL} bg-white/[0.65] text-emerald-800`}>
                    <Check className="h-3.5 w-3.5" /> {t.chargesEnabled}
                  </span>
                  <span className={`${ADMIN_STATUS_PILL} bg-white/[0.65] text-emerald-800`}>
                    <Check className="h-3.5 w-3.5" /> {t.payoutsEnabled}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleVerifyConnection}
                disabled={connectingToStripe}
                className={ADMIN_SECONDARY_BUTTON}
              >
                <RefreshCw className={`h-4 w-4 ${connectingToStripe ? 'animate-spin' : ''}`} />
                {t.refreshStatus}
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between gap-4 border-t border-emerald-200/70 pt-4">
              <div>
                <p className="text-sm font-medium text-emerald-950">{t.acceptCards}</p>
                <p className="mt-0.5 text-xs text-emerald-800/70">{t.acceptCardsHint}</p>
              </div>
              <Switch checked={stripeEnabled} onChange={setStripeEnabled} label={t.acceptCards} />
            </div>
          </div>
        ) : connectData?.stripe_connect_account_id ? (
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div className="flex-1">
                <p className="font-semibold text-amber-950">{t.setupUnfinished}</p>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-amber-800">
                  {t.setupUnfinishedHint}
                </p>
                <button
                  type="button"
                  onClick={handleConnectToStripe}
                  disabled={connectingToStripe}
                  className={`${ADMIN_PRIMARY_BUTTON} mt-4`}
                >
                  <ExternalLink className="h-4 w-4" />
                  {connectingToStripe ? t.openingStripe : t.continueInStripe}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 rounded-2xl bg-stone-900/[0.035] p-5 md:grid-cols-[1fr_220px] md:items-end">
            <div>
              <p className="text-sm font-medium text-[#1A1714]">{t.connectTitle}</p>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-500">
                {t.connectHint}
              </p>
              <button
                type="button"
                onClick={handleConnectToStripe}
                disabled={connectingToStripe}
                className={`${ADMIN_PRIMARY_BUTTON} mt-4`}
              >
                <Link2 className="h-4 w-4" />
                {connectingToStripe ? t.openingStripe : t.connectStripe}
              </button>
            </div>
            <div>
              <label htmlFor="stripe-country" className="mb-2 block text-xs font-medium text-stone-500">
                {t.registeredCountry}
              </label>
              <select
                id="stripe-country"
                value={selectedCountry}
                onChange={(event) => setSelectedCountry(event.target.value)}
                className={ADMIN_SELECT}
              >
                <option value="DE">{t.countryDE}</option>
                <option value="AT">{t.countryAT}</option>
                <option value="BE">{t.countryBE}</option>
                <option value="FR">{t.countryFR}</option>
                <option value="NL">{t.countryNL}</option>
                <option value="ES">{t.countryES}</option>
                <option value="IT">{t.countryIT}</option>
                <option value="US">{t.countryUS}</option>
              </select>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-5 border-b border-stone-200/70 pb-8">
        <SectionHeading
          icon={Banknote}
          title={t.payInShopTitle}
          description={t.payInShopDescription}
        />
        <div className="flex items-center justify-between gap-5 rounded-2xl bg-stone-900/[0.035] p-5">
          <div>
            <p className="text-sm font-medium text-[#1A1714]">{t.showPayInShop}</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-500">
              {t.showPayInShopHint}
            </p>
          </div>
          <Switch checked={allowPayInPerson} onChange={setAllowPayInPerson} label={t.allowPayInShop} />
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeading
          icon={WalletCards}
          title="PayPal"
          description={t.paypalDescription}
        />
        <div className="flex items-center justify-between gap-5 rounded-2xl bg-stone-900/[0.035] p-5">
          <div>
            <p className="text-sm font-medium text-[#1A1714]">{t.acceptPaypal}</p>
            <p className="mt-1 text-sm text-stone-500">{t.acceptPaypalHint}</p>
          </div>
          <Switch checked={paypalEnabled} onChange={setPaypalEnabled} label={t.acceptPaypal} />
        </div>

        {paypalEnabled && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="paypal-client-id" className="mb-2 block text-sm font-medium text-stone-700">
                {t.paypalClientId}
              </label>
              <input
                id="paypal-client-id"
                type="text"
                value={paypalClientId}
                onChange={(event) => setPaypalClientId(event.target.value)}
                className={ADMIN_INPUT}
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="paypal-secret" className="mb-2 block text-sm font-medium text-stone-700">
                {t.paypalSecret}
              </label>
              <input
                id="paypal-secret"
                type="password"
                value={paypalSecret}
                onChange={(event) => setPaypalSecret(event.target.value)}
                className={ADMIN_INPUT}
                autoComplete="new-password"
              />
            </div>
            <a
              href="https://developer.paypal.com/dashboard/applications/live"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition hover:text-[#1A1714] sm:col-span-2"
            >
              {t.openPaypalDashboard} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </section>

      <div className="flex justify-end border-t border-stone-200/70 pt-6">
        <button type="button" onClick={handleSave} disabled={saving} className={ADMIN_PRIMARY_BUTTON}>
          <Save className="h-4 w-4" />
          {saving ? t.saving : t.saveChanges}
        </button>
      </div>
    </div>
  );
}
