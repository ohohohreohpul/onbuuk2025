import { useState } from 'react';
import { Camera, Search, Gift, CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCurrency } from '../../lib/currencyContext';
import { useQrCodeScanner } from '../../hooks/useQrCodeScanner';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, Translations } from '../../lib/bookingLanguage';

const TEXT: Translations<{
  enterOrScan: string; checkFailed: string; notFound: string; fullyRedeemed: string; expired: string;
  passRedeemFailed: string; visitRedeemedOne: string; visitRedeemedMany: string; invalidAmount: string;
  exceedsBalance: string; redeemFailed: string; redeemedAmount: string; title: string; subtitle: string;
  manage: string; cancelScan: string; codePlaceholder: string; lookUp: string; scanQr: string;
  visitLeft: string; visitsLeft: string; minutes: string; balance: string; startOver: string;
  passHint: string; redeeming: string; redeemOneVisit: string; redeemAmount: string; redeem: string;
}> = {
  en: {
    enterOrScan: 'Please enter or scan a gift card code', checkFailed: 'Failed to check gift card balance',
    notFound: 'Gift card not found', fullyRedeemed: 'This gift card has already been fully redeemed',
    expired: 'This gift card has expired', passRedeemFailed: 'Failed to redeem service pass',
    visitRedeemedOne: 'One visit redeemed. 1 visit remains.', visitRedeemedMany: 'One visit redeemed. {count} visits remain.',
    invalidAmount: 'Enter a valid amount to redeem', exceedsBalance: 'Amount exceeds the remaining balance',
    redeemFailed: 'Failed to redeem gift card', redeemedAmount: 'Redeemed {amount}. Remaining balance: {balance}',
    title: 'Gift Card Station', subtitle: 'Check value balances or redeem a service-pass visit in person',
    manage: 'Manage Gift Cards', cancelScan: 'Cancel Scan', codePlaceholder: 'Enter gift card code', lookUp: 'Look up gift card',
    scanQr: 'Scan QR', visitLeft: '1 visit left', visitsLeft: '{count} visits left', minutes: '{count} min',
    balance: 'Balance:', startOver: 'Start over',
    passHint: 'Redeem one visit for the service shown above. The pass keeps its own visit count and is never converted into a cash balance.',
    redeeming: 'Redeeming...', redeemOneVisit: 'Redeem one visit', redeemAmount: 'Redeem Amount', redeem: 'Redeem',
  },
  de: {
    enterOrScan: 'Bitte einen Gutscheincode eingeben oder scannen', checkFailed: 'Guthaben konnte nicht geprüft werden',
    notFound: 'Gutschein nicht gefunden', fullyRedeemed: 'Dieser Gutschein wurde bereits vollständig eingelöst',
    expired: 'Dieser Gutschein ist abgelaufen', passRedeemFailed: 'Behandlungsgutschein konnte nicht eingelöst werden',
    visitRedeemedOne: 'Ein Besuch eingelöst. 1 Besuch verbleibt.', visitRedeemedMany: 'Ein Besuch eingelöst. {count} Besuche verbleiben.',
    invalidAmount: 'Bitte einen gültigen Betrag zum Einlösen eingeben', exceedsBalance: 'Betrag übersteigt das verbleibende Guthaben',
    redeemFailed: 'Gutschein konnte nicht eingelöst werden', redeemedAmount: '{amount} eingelöst. Restguthaben: {balance}',
    title: 'Gutschein-Station', subtitle: 'Guthaben prüfen oder einen Besuch eines Behandlungsgutscheins vor Ort einlösen',
    manage: 'Gutscheine verwalten', cancelScan: 'Scan abbrechen', codePlaceholder: 'Gutscheincode eingeben', lookUp: 'Gutschein suchen',
    scanQr: 'QR scannen', visitLeft: 'Noch 1 Besuch', visitsLeft: 'Noch {count} Besuche', minutes: '{count} Min.',
    balance: 'Guthaben:', startOver: 'Neu beginnen',
    passHint: 'Einen Besuch für die oben angezeigte Leistung einlösen. Der Gutschein behält seine eigene Besuchszahl und wird nie in Guthaben umgewandelt.',
    redeeming: 'Wird eingelöst...', redeemOneVisit: 'Einen Besuch einlösen', redeemAmount: 'Einzulösender Betrag', redeem: 'Einlösen',
  },
  th: {
    enterOrScan: 'กรุณากรอกหรือสแกนรหัสบัตรของขวัญ', checkFailed: 'ตรวจสอบยอดคงเหลือไม่สำเร็จ',
    notFound: 'ไม่พบบัตรของขวัญ', fullyRedeemed: 'บัตรของขวัญนี้ใช้ครบแล้ว',
    expired: 'บัตรของขวัญนี้หมดอายุแล้ว', passRedeemFailed: 'ใช้บัตรบริการไม่สำเร็จ',
    visitRedeemedOne: 'ใช้ไป 1 ครั้งแล้ว เหลืออีก 1 ครั้ง', visitRedeemedMany: 'ใช้ไป 1 ครั้งแล้ว เหลืออีก {count} ครั้ง',
    invalidAmount: 'กรุณากรอกจำนวนเงินที่ถูกต้อง', exceedsBalance: 'จำนวนเงินเกินยอดคงเหลือ',
    redeemFailed: 'ใช้บัตรของขวัญไม่สำเร็จ', redeemedAmount: 'ใช้ไป {amount} ยอดคงเหลือ: {balance}',
    title: 'จุดบริการบัตรของขวัญ', subtitle: 'ตรวจสอบยอดคงเหลือ หรือใช้สิทธิ์บัตรบริการที่ร้าน',
    manage: 'จัดการบัตรของขวัญ', cancelScan: 'ยกเลิกการสแกน', codePlaceholder: 'กรอกรหัสบัตรของขวัญ', lookUp: 'ค้นหาบัตรของขวัญ',
    scanQr: 'สแกน QR', visitLeft: 'เหลือ 1 ครั้ง', visitsLeft: 'เหลือ {count} ครั้ง', minutes: '{count} นาที',
    balance: 'ยอดคงเหลือ:', startOver: 'เริ่มใหม่',
    passHint: 'ใช้สิทธิ์ 1 ครั้งสำหรับบริการด้านบน บัตรนี้นับจำนวนครั้งแยกต่างหากและไม่แปลงเป็นยอดเงิน',
    redeeming: 'กำลังใช้บัตร...', redeemOneVisit: 'ใช้สิทธิ์ 1 ครั้ง', redeemAmount: 'จำนวนเงินที่ใช้', redeem: 'ใช้บัตร',
  },
};

interface GiftCardStationProps {
  businessId: string;
  onNavigate: (view: string) => void;
}

interface FoundGiftCard {
  id: string;
  code: string;
  current_balance_cents: number;
  card_type?: 'value' | 'service_pass';
  service_pass_name?: string | null;
  original_visits?: number | null;
  remaining_visits?: number | null;
  status: string;
  expires_at: string | null;
  service?: { name: string } | null;
  duration?: { duration_minutes: number } | null;
}

type Mode = 'type' | 'scan';

export default function GiftCardStation({ businessId, onNavigate }: GiftCardStationProps) {
  const { formatPrice } = useCurrency();
  const { t } = useAdminText(TEXT);
  const [mode, setMode] = useState<Mode>('type');
  const [code, setCode] = useState('');
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [card, setCard] = useState<FoundGiftCard | null>(null);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);

  const lookupCode = async (rawCode: string) => {
    const cleanCode = rawCode.trim().toUpperCase();
    if (!cleanCode) {
      setLookupError(t.enterOrScan);
      return;
    }

    setLooking(true);
    setLookupError(null);
    setCard(null);
    setRedeemSuccess(null);
    setRedeemError(null);

    const { data, error } = await supabase
      .from('gift_cards')
      .select('id, code, current_balance_cents, card_type, service_pass_name, original_visits, remaining_visits, status, expires_at, service:services(name), duration:service_durations(duration_minutes)')
      .eq('business_id', businessId)
      .eq('code', cleanCode)
      .maybeSingle();

    if (error) {
      console.error('Error checking gift card:', error);
      setLookupError(t.checkFailed);
    } else if (!data) {
      setLookupError(t.notFound);
    } else if (data.status === 'fully_redeemed') {
      setLookupError(t.fullyRedeemed);
    } else if (data.status === 'expired' || (data.expires_at && new Date(data.expires_at) < new Date())) {
      setLookupError(t.expired);
    } else {
      const service = Array.isArray(data.service) ? data.service[0] : data.service;
      const duration = Array.isArray(data.duration) ? data.duration[0] : data.duration;
      setCard({ ...data, service: service || null, duration: duration || null });
      setRedeemAmount(data.card_type === 'service_pass' ? '' : (data.current_balance_cents / 100).toFixed(2));
    }

    setLooking(false);
  };

  const handleDetected = (value: string) => {
    const detectedCode = value.trim().toUpperCase();
    setMode('type');
    setCode(detectedCode);
    lookupCode(detectedCode);
  };

  const scanner = useQrCodeScanner({ onDetected: handleDetected });

  const handleStartScan = () => {
    setMode('scan');
    setLookupError(null);
    scanner.start();
  };

  const handleCancelScan = () => {
    scanner.stop();
    setMode('type');
  };

  const handleRedeem = async () => {
    if (!card) return;

    if (card.card_type === 'service_pass') {
      setRedeeming(true);
      setRedeemError(null);
      setRedeemSuccess(null);
      const { data, error } = await supabase.rpc('redeem_service_pass_at_pos', { p_code: card.code });
      if (error) {
        setRedeemError(error.message || t.passRedeemFailed);
      } else {
        const remainingVisits = Number(data?.remainingVisits || 0);
        setCard({ ...card, remaining_visits: remainingVisits, status: remainingVisits === 0 ? 'fully_redeemed' : card.status });
        setRedeemSuccess(remainingVisits === 1 ? t.visitRedeemedOne : fillText(t.visitRedeemedMany, { count: remainingVisits }));
      }
      setRedeeming(false);
      return;
    }

    const amountCents = Math.round(parseFloat(redeemAmount) * 100);
    if (!amountCents || amountCents <= 0) {
      setRedeemError(t.invalidAmount);
      return;
    }
    if (amountCents > card.current_balance_cents) {
      setRedeemError(t.exceedsBalance);
      return;
    }

    setRedeeming(true);
    setRedeemError(null);
    setRedeemSuccess(null);

    const { data, error } = await supabase.rpc('redeem_gift_card', {
      p_gift_card_id: card.id,
      p_business_id: businessId,
      p_amount_cents: amountCents,
      p_description: 'In-person redemption via dashboard',
    });

    if (error) {
      console.error('Error redeeming gift card:', error);
      setRedeemError(error.message || t.redeemFailed);
    } else {
      const newBalance = data as number;
      setCard({ ...card, current_balance_cents: newBalance, status: newBalance === 0 ? 'redeemed' : card.status });
      setRedeemAmount((newBalance / 100).toFixed(2));
      setRedeemSuccess(fillText(t.redeemedAmount, { amount: formatPrice(amountCents), balance: formatPrice(newBalance) }));
    }

    setRedeeming(false);
  };

  const resetStation = () => {
    setCode('');
    setCard(null);
    setLookupError(null);
    setRedeemError(null);
    setRedeemSuccess(null);
    setRedeemAmount('');
  };

  return (
    <Card glass>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#1A1714] to-[#3D3833]">
              <Gift className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">{t.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{t.subtitle}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => onNavigate('gift-cards')}>
            {t.manage}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === 'scan' ? (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-w-md mx-auto">
              <video ref={scanner.videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-0 border-4 border-white/30 m-8 rounded-xl pointer-events-none"></div>
            </div>
            {scanner.error && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {scanner.error}
              </div>
            )}
            <div className="flex justify-center">
              <Button variant="outline" onClick={handleCancelScan}>
                <X className="h-4 w-4 mr-2" />
                {t.cancelScan}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && lookupCode(code)}
              placeholder={t.codePlaceholder}
              aria-label={t.codePlaceholder}
              className="flex-1 px-4 py-3 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1A1714]/20 focus:border-[#1A1714] transition-all uppercase placeholder:normal-case"
            />
            <div className="flex gap-3">
              <Button
                onClick={() => lookupCode(code)}
                disabled={looking || !code.trim()}
                aria-label={t.lookUp}
                className="bg-gradient-to-r from-[#1A1714] to-[#3D3833] hover:shadow-lg hover:shadow-[#1A1714]/25 px-6"
              >
                {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
              <Button variant="outline" onClick={handleStartScan}>
                <Camera className="h-4 w-4 mr-2" />
                {t.scanQr}
              </Button>
            </div>
          </div>
        )}

        {lookupError && (
          <div className="flex items-center gap-3 p-4 bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-xl text-red-700 animate-fade-in">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{lookupError}</p>
          </div>
        )}

        {card && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50/80 backdrop-blur-sm border border-green-200 rounded-xl">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-900">{card.code}</p>
                <p className="text-sm text-green-700 mt-0.5">
                  {card.card_type === 'service_pass' ? (
                    <><span className="font-bold text-lg">{(card.remaining_visits || 0) === 1 ? t.visitLeft : fillText(t.visitsLeft, { count: card.remaining_visits || 0 })}</span><span className="block text-xs">{card.service_pass_name} · {card.service?.name} · {fillText(t.minutes, { count: card.duration?.duration_minutes ?? '' })}</span></>
                  ) : (
                    <>{t.balance} <span className="font-bold text-lg">{formatPrice(card.current_balance_cents)}</span></>
                  )}
                </p>
              </div>
              <button onClick={resetStation} className="text-green-700 hover:text-green-900" title={t.startOver}
                aria-label={t.startOver}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {card.card_type === 'service_pass' && (card.remaining_visits || 0) > 0 ? (
              <div className="space-y-3 rounded-xl border border-gray-200 bg-white/70 p-4">
                <p className="text-sm leading-6 text-gray-600">{t.passHint}</p>
                <Button onClick={handleRedeem} disabled={redeeming} className="w-full bg-gradient-to-r from-[#1A1714] to-[#3D3833] px-6">
                  {redeeming ? t.redeeming : t.redeemOneVisit}
                </Button>
              </div>
            ) : card.current_balance_cents > 0 && (
              <div className="p-4 bg-white/70 border border-gray-200 rounded-xl space-y-3">
                <label className="block text-sm font-medium text-gray-700">{t.redeemAmount}</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={card.current_balance_cents / 100}
                    value={redeemAmount}
                    onChange={(e) => setRedeemAmount(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1A1714]/20 focus:border-[#1A1714]"
                  />
                  <Button
                    onClick={handleRedeem}
                    disabled={redeeming}
                    className="bg-gradient-to-r from-[#1A1714] to-[#3D3833] px-6"
                  >
                    {redeeming ? t.redeeming : t.redeem}
                  </Button>
                </div>
              </div>
            )}

            {redeemError && (
              <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {redeemError}
              </div>
            )}

            {redeemSuccess && (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                {redeemSuccess}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
