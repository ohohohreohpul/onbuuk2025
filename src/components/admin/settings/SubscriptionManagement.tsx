import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Crown, Calendar, CreditCard, Check, Loader, AlertCircle, Tag } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';
import { useCurrency } from '../../../lib/currencyContext';
import { adminAccessToken } from '../../../lib/functionAuth';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText, type Translations } from '../../../lib/bookingLanguage';

interface Business {
  id: string;
  name: string;
  plan_type: string;
  subscription_status: string | null;
  trial_end_date: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

type FeatureKey =
  | 'fOneAdmin' | 'f50Bookings' | 'f3Services' | 'fOneSpecialist' | 'fEmailNotifications' | 'f3Admins'
  | 'fUnlimitedBookings' | 'f10Services' | 'f3Specialists' | 'fGiftCards' | 'fBasicLoyalty' | 'fCustomLogo'
  | 'fUnlimitedAdmins' | 'fUnlimitedServices' | 'fUnlimitedSpecialists' | 'fAdvancedGiftCards'
  | 'fAdvancedLoyalty' | 'fFullBranding' | 'fRemoveBadge' | 'fPrioritySupport';

type SubscriptionText = Record<FeatureKey, string> & {
  upgradeSuccess: string; upgradeCancelled: string; signInAgain: string; invalidCoupon: string; upgradeFailed: string;
  portalFailed: string; businessNotFound: string; title: string; subtitle: string; trialActive: string;
  trialEndsInDay: string; trialEndsInDays: string; currentPlan: string; freeTrialActive: string; statusLabel: string;
  active: string; freeForever: string; perMonth: string; includes: string; manageBilling: string; upgradePlan: string;
  upgradeTo: string; couponLabel: string; couponPlaceholder: string; couponHint: string; processing: string;
  onPlan: string; onPlanHint: string; mostPopular: string; moreFeature: string; moreFeatures: string;
  statusPastDue: string; statusCanceled: string; statusUnpaid: string; statusIncompleteExpired: string; statusPaused: string;
};

const TEXT: Translations<SubscriptionText> = {
  en: {
    fOneAdmin: '1 admin user (owner only)', f50Bookings: 'Up to 50 bookings per month', f3Services: 'Up to 3 services',
    fOneSpecialist: '1 specialist', fEmailNotifications: 'Email notifications', f3Admins: 'Up to 3 admin users',
    fUnlimitedBookings: 'Unlimited bookings', f10Services: 'Up to 10 services', f3Specialists: 'Up to 3 specialists',
    fGiftCards: 'Gift cards enabled', fBasicLoyalty: 'Basic loyalty program', fCustomLogo: 'Custom logo',
    fUnlimitedAdmins: 'Unlimited admin users', fUnlimitedServices: 'Unlimited services', fUnlimitedSpecialists: 'Unlimited specialists',
    fAdvancedGiftCards: 'Advanced gift cards', fAdvancedLoyalty: 'Advanced loyalty program', fFullBranding: 'Full custom branding',
    fRemoveBadge: 'Remove "Powered by Zenno" badge', fPrioritySupport: 'Priority support',
    upgradeSuccess: 'Successfully upgraded! Your subscription will be activated shortly.',
    upgradeCancelled: 'Upgrade cancelled. You can try again anytime.', signInAgain: 'Please sign in again to continue',
    invalidCoupon: 'Invalid or expired coupon code. Please check and try again.',
    upgradeFailed: 'Failed to start upgrade process. Please try again or contact support.',
    portalFailed: 'Failed to open subscription management. Please try again.', businessNotFound: 'Business not found',
    title: 'Subscription Management', subtitle: 'Manage your plan and billing', trialActive: 'Trial Active',
    trialEndsInDay: 'Your free trial ends in {count} day', trialEndsInDays: 'Your free trial ends in {count} days',
    currentPlan: 'Current Plan', freeTrialActive: '🎉 Free Trial Active', statusLabel: 'Status: {status}', active: 'Active',
    freeForever: 'Free forever', perMonth: 'starting at / month', includes: 'Current Plan Includes:', manageBilling: 'Manage Billing',
    upgradePlan: 'Upgrade Your Plan', upgradeTo: 'Upgrade to {plan}', couponLabel: 'Coupon Code (Optional)',
    couponPlaceholder: 'Enter coupon code', couponHint: 'You can also enter or apply a coupon code during checkout',
    processing: 'Processing...', onPlan: "You're on the {plan} Plan!",
    onPlanHint: 'You have access to all features and unlimited usage. Thank you for being a {plan} member!',
    mostPopular: 'Most Popular', moreFeature: '+ {count} more feature', moreFeatures: '+ {count} more features',
    statusPastDue: 'Past due', statusCanceled: 'Canceled', statusUnpaid: 'Unpaid', statusIncompleteExpired: 'Expired', statusPaused: 'Paused',
  },
  de: {
    fOneAdmin: '1 Admin-Benutzer (nur Inhaber)', f50Bookings: 'Bis zu 50 Buchungen pro Monat', f3Services: 'Bis zu 3 Leistungen',
    fOneSpecialist: '1 Mitarbeiter', fEmailNotifications: 'E-Mail-Benachrichtigungen', f3Admins: 'Bis zu 3 Admin-Benutzer',
    fUnlimitedBookings: 'Unbegrenzte Buchungen', f10Services: 'Bis zu 10 Leistungen', f3Specialists: 'Bis zu 3 Mitarbeiter',
    fGiftCards: 'Gutscheine aktiviert', fBasicLoyalty: 'Einfaches Treueprogramm', fCustomLogo: 'Eigenes Logo',
    fUnlimitedAdmins: 'Unbegrenzte Admin-Benutzer', fUnlimitedServices: 'Unbegrenzte Leistungen', fUnlimitedSpecialists: 'Unbegrenzte Mitarbeiter',
    fAdvancedGiftCards: 'Erweiterte Gutscheine', fAdvancedLoyalty: 'Erweitertes Treueprogramm', fFullBranding: 'Vollständig eigenes Branding',
    fRemoveBadge: 'Hinweis „Powered by Zenno“ entfernen', fPrioritySupport: 'Bevorzugter Support',
    upgradeSuccess: 'Upgrade erfolgreich. Ihr Abo wird in Kürze aktiviert.',
    upgradeCancelled: 'Upgrade abgebrochen. Sie können es jederzeit erneut versuchen.', signInAgain: 'Bitte erneut anmelden, um fortzufahren',
    invalidCoupon: 'Ungültiger oder abgelaufener Gutscheincode. Bitte prüfen und erneut versuchen.',
    upgradeFailed: 'Upgrade konnte nicht gestartet werden. Bitte erneut versuchen oder den Support kontaktieren.',
    portalFailed: 'Abo-Verwaltung konnte nicht geöffnet werden. Bitte erneut versuchen.', businessNotFound: 'Geschäft nicht gefunden',
    title: 'Abo-Verwaltung', subtitle: 'Tarif und Abrechnung verwalten', trialActive: 'Testphase aktiv',
    trialEndsInDay: 'Ihre kostenlose Testphase endet in {count} Tag', trialEndsInDays: 'Ihre kostenlose Testphase endet in {count} Tagen',
    currentPlan: 'Aktueller Tarif', freeTrialActive: '🎉 Kostenlose Testphase aktiv', statusLabel: 'Status: {status}', active: 'Aktiv',
    freeForever: 'Dauerhaft kostenlos', perMonth: 'ab / Monat', includes: 'Ihr Tarif enthält:', manageBilling: 'Abrechnung verwalten',
    upgradePlan: 'Tarif upgraden', upgradeTo: 'Upgrade auf {plan}', couponLabel: 'Gutscheincode (optional)',
    couponPlaceholder: 'Gutscheincode eingeben', couponHint: 'Ein Gutscheincode kann auch beim Bezahlen eingegeben werden',
    processing: 'Wird verarbeitet...', onPlan: 'Sie nutzen den Tarif {plan}!',
    onPlanHint: 'Sie haben Zugriff auf alle Funktionen ohne Nutzungslimit. Danke, dass Sie {plan} nutzen!',
    mostPopular: 'Am beliebtesten', moreFeature: '+ {count} weitere Funktion', moreFeatures: '+ {count} weitere Funktionen',
    statusPastDue: 'Überfällig', statusCanceled: 'Gekündigt', statusUnpaid: 'Unbezahlt', statusIncompleteExpired: 'Abgelaufen', statusPaused: 'Pausiert',
  },
  th: {
    fOneAdmin: 'ผู้ดูแล 1 คน (เฉพาะเจ้าของ)', f50Bookings: 'การจองสูงสุด 50 รายการต่อเดือน', f3Services: 'บริการสูงสุด 3 รายการ',
    fOneSpecialist: 'พนักงาน 1 คน', fEmailNotifications: 'การแจ้งเตือนทางอีเมล', f3Admins: 'ผู้ดูแลสูงสุด 3 คน',
    fUnlimitedBookings: 'การจองไม่จำกัด', f10Services: 'บริการสูงสุด 10 รายการ', f3Specialists: 'พนักงานสูงสุด 3 คน',
    fGiftCards: 'เปิดใช้บัตรของขวัญ', fBasicLoyalty: 'โปรแกรมสะสมแต้มพื้นฐาน', fCustomLogo: 'ใช้โลโก้ของร้าน',
    fUnlimitedAdmins: 'ผู้ดูแลไม่จำกัด', fUnlimitedServices: 'บริการไม่จำกัด', fUnlimitedSpecialists: 'พนักงานไม่จำกัด',
    fAdvancedGiftCards: 'บัตรของขวัญขั้นสูง', fAdvancedLoyalty: 'โปรแกรมสะสมแต้มขั้นสูง', fFullBranding: 'ปรับแบรนด์ได้เต็มรูปแบบ',
    fRemoveBadge: 'ลบป้าย "Powered by Zenno"', fPrioritySupport: 'ซัพพอร์ตแบบเร่งด่วน',
    upgradeSuccess: 'อัปเกรดสำเร็จ แพ็กเกจสมาชิกจะเปิดใช้งานในไม่ช้า',
    upgradeCancelled: 'ยกเลิกการอัปเกรดแล้ว ลองใหม่ได้ทุกเมื่อ', signInAgain: 'กรุณาเข้าสู่ระบบอีกครั้งเพื่อดำเนินการต่อ',
    invalidCoupon: 'รหัสคูปองไม่ถูกต้องหรือหมดอายุ กรุณาตรวจสอบแล้วลองอีกครั้ง',
    upgradeFailed: 'เริ่มการอัปเกรดไม่สำเร็จ กรุณาลองอีกครั้งหรือติดต่อฝ่ายซัพพอร์ต',
    portalFailed: 'เปิดหน้าจัดการแพ็กเกจสมาชิกไม่สำเร็จ กรุณาลองอีกครั้ง', businessNotFound: 'ไม่พบร้าน',
    title: 'จัดการแพ็กเกจสมาชิก', subtitle: 'จัดการแพ็กเกจและการเรียกเก็บเงิน', trialActive: 'อยู่ในช่วงทดลองใช้',
    trialEndsInDay: 'ช่วงทดลองใช้ฟรีจะสิ้นสุดใน {count} วัน', trialEndsInDays: 'ช่วงทดลองใช้ฟรีจะสิ้นสุดใน {count} วัน',
    currentPlan: 'แพ็กเกจปัจจุบัน', freeTrialActive: '🎉 กำลังทดลองใช้ฟรี', statusLabel: 'สถานะ: {status}', active: 'ใช้งานอยู่',
    freeForever: 'ฟรีตลอดไป', perMonth: 'เริ่มต้น / เดือน', includes: 'แพ็กเกจปัจจุบันประกอบด้วย:', manageBilling: 'จัดการการเรียกเก็บเงิน',
    upgradePlan: 'อัปเกรดแพ็กเกจ', upgradeTo: 'อัปเกรดเป็น {plan}', couponLabel: 'รหัสคูปอง (ไม่บังคับ)',
    couponPlaceholder: 'ใส่รหัสคูปอง', couponHint: 'ใส่รหัสคูปองตอนชำระเงินได้เช่นกัน',
    processing: 'กำลังดำเนินการ...', onPlan: 'คุณใช้แพ็กเกจ {plan} อยู่',
    onPlanHint: 'คุณใช้ได้ทุกฟีเจอร์แบบไม่จำกัด ขอบคุณที่เป็นสมาชิก {plan}',
    mostPopular: 'ยอดนิยม', moreFeature: '+ อีก {count} ฟีเจอร์', moreFeatures: '+ อีก {count} ฟีเจอร์',
    statusPastDue: 'เกินกำหนดชำระ', statusCanceled: 'ยกเลิกแล้ว', statusUnpaid: 'ยังไม่ชำระ', statusIncompleteExpired: 'หมดอายุ', statusPaused: 'หยุดชั่วคราว',
  },
};

/** Stripe subscription status (DB value) to a label; unknown values are shown as stored. */
function statusName(status: string, t: SubscriptionText): string {
  const known: Record<string, string> = {
    active: t.active,
    trialing: t.trialActive,
    past_due: t.statusPastDue,
    canceled: t.statusCanceled,
    unpaid: t.statusUnpaid,
    incomplete_expired: t.statusIncompleteExpired,
    paused: t.statusPaused,
  };
  return known[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
}

interface PlanDetails {
  name: string;
  priceCents: number;
  features: FeatureKey[];
}

const VISIBLE_FEATURES = 5;

const PLAN_DETAILS: Record<string, PlanDetails> = {
  free: {
    name: 'Free',
    priceCents: 0,
    features: ['fOneAdmin', 'f50Bookings', 'f3Services', 'fOneSpecialist', 'fEmailNotifications'],
  },
  standard: {
    name: 'Standard',
    priceCents: 2900,
    features: [
      'f3Admins', 'fUnlimitedBookings', 'f10Services', 'f3Specialists', 'fGiftCards', 'fBasicLoyalty',
      'fCustomLogo', 'fEmailNotifications',
    ],
  },
  pro: {
    name: 'Pro',
    priceCents: 4500,
    features: [
      'fUnlimitedAdmins', 'fUnlimitedBookings', 'fUnlimitedServices', 'fUnlimitedSpecialists', 'fAdvancedGiftCards',
      'fAdvancedLoyalty', 'fFullBranding', 'fRemoveBadge', 'fEmailNotifications', 'fPrioritySupport',
    ],
  },
};

export default function SubscriptionManagement() {
  const { t, locale } = useAdminText(TEXT);
  const { businessId } = useTenant();
  const { formatAmount } = useCurrency();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [upgradeResult, setUpgradeResult] = useState<'success' | 'cancelled' | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'standard' | 'pro' | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');

  useEffect(() => {
    fetchBusiness();

    const params = new URLSearchParams(window.location.search);
    if (params.get('upgrade') === 'success') {
      setUpgradeResult('success');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('upgrade') === 'cancelled') {
      setUpgradeResult('cancelled');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [businessId]);

  const fetchBusiness = async () => {
    if (!businessId) return;

    const { data } = await supabase
      .from('businesses')
      .select('id, name, plan_type, subscription_status, trial_end_date, stripe_customer_id, stripe_subscription_id')
      .eq('id', businessId)
      .single();

    if (data) {
      setBusiness(data);
    }

    setLoading(false);
  };

  const handleUpgrade = async (planType: 'standard' | 'pro') => {
    if (processing || !businessId) return;

    setProcessing(true);
    setCouponError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert(t.signInAgain);
        setProcessing(false);
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upgrade-subscription`;

      const requestBody: {
        business_id: string;
        plan_type: string;
        coupon_code?: string;
      } = {
        business_id: businessId,
        plan_type: planType,
      };

      if (couponCode.trim()) {
        requestBody.coupon_code = couponCode.trim();
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await adminAccessToken()}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Stripe checkout error:', errorData);

        if (errorData.error && errorData.error.toLowerCase().includes('coupon')) {
          setCouponError(t.invalidCoupon);
          setProcessing(false);
          return;
        }

        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const data = await response.json();

      if (!data.url) {
        throw new Error('No checkout URL returned');
      }

      window.location.href = data.url;
    } catch (error) {
      console.error('Upgrade error:', error);
      alert(t.upgradeFailed);
      setProcessing(false);
    }
  };

  const handleManageSubscription = async () => {
    if (processing || !business?.stripe_customer_id || !businessId) return;

    setProcessing(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-portal-session`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await adminAccessToken()}`,
        },
        body: JSON.stringify({
          business_id: businessId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Portal session error:', errorData);
        throw new Error(errorData.error || 'Failed to create portal session');
      }

      const data = await response.json();

      if (!data.url) {
        throw new Error('No portal URL returned');
      }

      window.location.href = data.url;
    } catch (error) {
      console.error('Error:', error);
      alert(t.portalFailed);
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-6 h-6 text-stone-600 animate-spin" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-stone-600">{t.businessNotFound}</p>
      </div>
    );
  }

  const currentPlan = business.plan_type.toLowerCase();
  const isFree = currentPlan === 'free' || currentPlan === 'starter';
  const isStandard = currentPlan === 'standard';
  const isPro = currentPlan === 'pro';
  const isTrialing = business.subscription_status === 'trialing';
  const trialEndDate = business.trial_end_date ? new Date(business.trial_end_date) : null;
  const daysUntilTrialEnd = trialEndDate
    ? Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-stone-800 mb-2">{t.title}</h3>
        <p className="text-sm text-stone-600">{t.subtitle}</p>
      </div>

      {upgradeResult && (
        <div className={`border p-4 ${
          upgradeResult === 'cancelled'
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-green-50 border-green-200 text-green-800'
        }`}>
          <p className="text-sm font-medium">{upgradeResult === 'cancelled' ? t.upgradeCancelled : t.upgradeSuccess}</p>
        </div>
      )}

      {isTrialing && daysUntilTrialEnd !== null && daysUntilTrialEnd > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-4 flex items-start space-x-3">
          <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900">{t.trialActive}</h4>
            <p className="text-sm text-blue-800">
              {fillText(daysUntilTrialEnd === 1 ? t.trialEndsInDay : t.trialEndsInDays, { count: daysUntilTrialEnd })}
              {trialEndDate && ` (${trialEndDate.toLocaleDateString(locale)})`}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border border-stone-200 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 flex items-center justify-center ${
                isPro ? 'bg-gradient-to-br from-amber-400 to-amber-600' :
                isStandard ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                'bg-stone-200'
              }`}>
                <Crown className={`w-6 h-6 ${isPro || isStandard ? 'text-white' : 'text-stone-600'}`} />
              </div>
              <div>
                <h4 className="text-xl font-bold text-stone-900">
                  {PLAN_DETAILS[currentPlan]?.name || t.currentPlan}
                </h4>
                <p className={`text-sm font-medium ${isTrialing ? 'text-blue-600' : 'text-stone-600'}`}>
                  {isTrialing
                    ? t.freeTrialActive
                    : business.subscription_status && business.subscription_status !== 'incomplete'
                      ? fillText(t.statusLabel, { status: statusName(business.subscription_status, t) })
                      : t.active
                  }
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-stone-900">
                {formatAmount((PLAN_DETAILS[currentPlan]?.priceCents || 0) / 100)}
              </p>
              <p className="text-sm text-stone-600">{isFree ? t.freeForever : t.perMonth}</p>
            </div>
          </div>

          <div className="border-t border-stone-200 pt-6 mb-6">
            <h5 className="font-semibold text-stone-900 mb-3">{t.includes}</h5>
            <div className="space-y-2">
              {PLAN_DETAILS[currentPlan]?.features.map((feature) => (
                <div key={feature} className="flex items-start space-x-2">
                  <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-stone-700">{t[feature]}</span>
                </div>
              ))}
            </div>
          </div>

          {business.stripe_customer_id && !isFree && (
            <div className="flex items-center space-x-3 mb-4">
              <button
                onClick={handleManageSubscription}
                disabled={processing}
                className="flex-1 bg-stone-100 text-stone-900 py-3 px-6 font-semibold hover:bg-stone-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <CreditCard className="w-5 h-5" />
                <span>{t.manageBilling}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {(isFree || isStandard) && (
        <div className="space-y-4">
          <h4 className="font-bold text-stone-900 text-lg">
            {isFree ? t.upgradePlan : fillText(t.upgradeTo, { plan: PLAN_DETAILS.pro.name })}
          </h4>

          {isFree && (
            <div className="grid md:grid-cols-2 gap-4">
              <PlanCard
                planType="standard"
                selected={selectedPlan === 'standard'}
                onSelect={() => setSelectedPlan('standard')}
                processing={processing}
                formatAmount={formatAmount}
              />
              <PlanCard
                planType="pro"
                selected={selectedPlan === 'pro'}
                onSelect={() => setSelectedPlan('pro')}
                processing={processing}
                popular
                formatAmount={formatAmount}
              />
            </div>
          )}

          {isStandard && (
            <div className="max-w-md">
              <PlanCard
                planType="pro"
                selected={selectedPlan === 'pro'}
                onSelect={() => setSelectedPlan('pro')}
                processing={processing}
                popular
                formatAmount={formatAmount}
              />
            </div>
          )}

          {selectedPlan && (
            <div className="bg-stone-50 border border-stone-200 p-6 space-y-4">
              <div>
                <label className="flex items-center text-sm font-medium text-stone-700 mb-2">
                  <Tag className="w-4 h-4 mr-2" />
                  {t.couponLabel}
                </label>
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value);
                    setCouponError('');
                  }}
                  placeholder={t.couponPlaceholder}
                  disabled={processing}
                  className="w-full px-4 py-2 border border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {couponError && (
                  <p className="text-sm text-red-600 mt-1">{couponError}</p>
                )}
                <p className="text-xs text-stone-500 mt-1">
                  {t.couponHint}
                </p>
              </div>

              <button
                onClick={() => handleUpgrade(selectedPlan)}
                disabled={processing}
                className="w-full bg-stone-900 text-white py-3 px-6 font-semibold hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {processing ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>{t.processing}</span>
                  </>
                ) : (
                  <>
                    <Crown className="w-5 h-5" />
                    <span>{fillText(t.upgradeTo, { plan: PLAN_DETAILS[selectedPlan].name })}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {isPro && (
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 p-6">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-amber-600 flex items-center justify-center flex-shrink-0">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-amber-900 text-lg mb-2">{fillText(t.onPlan, { plan: PLAN_DETAILS.pro.name })}</h4>
              <p className="text-sm text-amber-800">
                {fillText(t.onPlanHint, { plan: PLAN_DETAILS.pro.name })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface PlanCardProps {
  planType: 'standard' | 'pro';
  selected: boolean;
  onSelect: () => void;
  processing: boolean;
  popular?: boolean;
  formatAmount: (amount: number) => string;
}

function PlanCard({ planType, selected, onSelect, processing, popular, formatAmount }: PlanCardProps) {
  const { t } = useAdminText(TEXT);
  const plan = PLAN_DETAILS[planType];
  const hiddenCount = plan.features.length - VISIBLE_FEATURES;

  return (
    <div
      onClick={!processing ? onSelect : undefined}
      className={`relative border-2 p-6 cursor-pointer transition-all ${
        selected
          ? 'border-stone-900 bg-stone-50'
          : 'border-stone-200 bg-white hover:border-stone-300'
      } ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <span className="bg-amber-600 text-white px-3 py-1 text-xs font-semibold">
            {t.mostPopular}
          </span>
        </div>
      )}

      <div className="mb-4">
        <h5 className="text-xl font-bold text-stone-900 mb-1">{plan.name}</h5>
        <div className="flex items-baseline">
          <span className="text-3xl font-bold text-stone-900">{formatAmount(plan.priceCents / 100)}</span>
          <span className="text-stone-600 ml-1 text-sm">{t.perMonth}</span>
        </div>
      </div>

      <ul className="space-y-2 mb-4">
        {plan.features.slice(0, VISIBLE_FEATURES).map((feature) => (
          <li key={feature} className="flex items-start text-sm">
            <Check className="w-4 h-4 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-stone-700">{t[feature]}</span>
          </li>
        ))}
        {hiddenCount > 0 && (
          <li className="text-sm text-stone-500 ml-6">
            {fillText(hiddenCount === 1 ? t.moreFeature : t.moreFeatures, { count: hiddenCount })}
          </li>
        )}
      </ul>

      <div className={`w-5 h-5 border-2 rounded-full flex items-center justify-center ${
        selected ? 'border-stone-900 bg-stone-900' : 'border-stone-300'
      }`}>
        {selected && <div className="w-2 h-2 bg-white rounded-full" />}
      </div>
    </div>
  );
}
