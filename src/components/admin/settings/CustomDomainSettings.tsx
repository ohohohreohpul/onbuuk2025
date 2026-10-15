import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Globe, Plus, Check, X, AlertCircle, Copy, RefreshCw, Trash2, Crown, ExternalLink } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';
import { usePremiumFeatures } from '../../../hooks/usePremiumFeatures';
import { adminAccessToken } from '../../../lib/functionAuth';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText, type Translations } from '../../../lib/bookingLanguage';

const TEXT: Translations<{
  upgradeFailed: string; enterDomain: string; invalidDomain: string; domainExists: string; addFailed: string;
  verifyFailed: string; verifySuccess: string; dnsNotReady: string; dnsNotReadyDefault: string; verifyError: string; unknownError: string;
  setPrimaryFailed: string; confirmRemove: string; removeFailedReason: string; removed: string; removeFailed: string;
  badgeActive: string; badgeProvisioning: string; badgeDnsVerified: string; badgeFailed: string; badgePendingDns: string;
  sslActive: string; sslProvisioning: string; sslFailed: string; sslPending: string;
  proTitle: string; proBody: string; processing: string; upgrade: string;
  whyTitle: string; why1: string; why2: string; why3: string; why4: string;
  loading: string; setupTitle: string; setupBody: string; addTitle: string; adding: string; addDomain: string; addHint: string;
  yourDomains: string; primary: string; dnsErrorTitle: string; platformErrorTitle: string; netlifyNotConfigured: string;
  verifiedOn: string; addedOn: string; lastChecked: string; addingTitle: string; addingBody: string;
  setPrimary: string; retrying: string; retry: string; checking: string; verify: string; removeDomain: string;
  troubleTitle: string; troubleIntro: string; trouble1: string; trouble2: string; trouble3: string; trouble4: string; trouble5: string;
  dnsRequired: string; dnsIntro: string; colType: string; colName: string; colValue: string; copied: string; copy: string;
  dnsNote1: string; dnsNote2: string; domainActive: string; domainActiveBody: string;
  stepsTitle: string; step1Title: string; step1Body: string; step2Title: string; step2Body: string; step3Title: string; step3Body: string;
  step4Title: string; step4Body: string; step5Title: string; step5Body: string;
}> = {
  en: {
    upgradeFailed: 'Failed to start upgrade process. Please try again or contact support.',
    enterDomain: 'Please enter a domain', invalidDomain: 'Please enter a valid domain (e.g., bookings.example.com)', domainExists: 'This domain is already added',
    addFailed: 'Failed to add domain. Please try again.',
    verifyFailed: 'Verification failed: {error}',
    verifySuccess: 'Domain verified successfully! Your domain is being added to our platform and SSL certificate will be provisioned within 5-15 minutes.',
    dnsNotReady: 'DNS not configured yet: {reason}', dnsNotReadyDefault: 'Please check your DNS settings and ensure the CNAME record is correct.',
    verifyError: 'Failed to verify domain: {error}', unknownError: 'Unknown error occurred',
    setPrimaryFailed: 'Failed to set primary domain.',
    confirmRemove: 'Are you sure you want to remove {domain}? This will remove it from Netlify and your database.',
    removeFailedReason: 'Failed to remove domain: {error}', removed: 'Domain removed successfully!', removeFailed: 'Failed to remove domain. Please try again.',
    badgeActive: 'Active', badgeProvisioning: 'Adding to Platform', badgeDnsVerified: 'DNS Verified', badgeFailed: 'Failed', badgePendingDns: 'Pending DNS',
    sslActive: 'SSL Active', sslProvisioning: 'SSL Provisioning', sslFailed: 'SSL Failed', sslPending: 'SSL Pending',
    proTitle: 'Custom Domains - Pro Feature',
    proBody: 'Connect your own domain to create a fully branded booking experience. Upgrade to Pro to unlock custom domains with automatic SSL certificates.',
    processing: 'Processing...', upgrade: 'Upgrade to Pro →',
    whyTitle: 'Why Use a Custom Domain?',
    why1: 'Professional appearance with your own brand (e.g., bookings.yourbusiness.com)', why2: 'Builds trust with your customers',
    why3: 'Automatic SSL certificate for secure HTTPS connections', why4: 'Better SEO and memorability',
    loading: 'Loading domains...', setupTitle: 'Custom Domain Setup',
    setupBody: "Connect your own domain to create a fully branded booking experience. Add your domain, configure DNS, and we'll handle the SSL certificate automatically through Netlify.",
    addTitle: 'Add Custom Domain', adding: 'Adding...', addDomain: 'Add Domain',
    addHint: 'Enter a subdomain like "bookings.yourdomain.com" or "book.yourdomain.com"',
    yourDomains: 'Your Domains', primary: 'Primary', dnsErrorTitle: 'DNS Verification Error', platformErrorTitle: 'Platform Integration Error',
    netlifyNotConfigured: 'Netlify credentials are not configured. Contact support for assistance.',
    verifiedOn: 'DNS Verified: {date}', addedOn: 'Added to Platform: {date}', lastChecked: 'Last checked: {date}',
    addingTitle: 'Adding domain to platform...', addingBody: 'This usually takes 5-15 minutes. SSL certificate will be provisioned automatically.',
    setPrimary: 'Set as Primary', retrying: 'Retrying...', retry: 'Retry', checking: 'Checking...', verify: 'Verify', removeDomain: 'Remove domain',
    troubleTitle: 'Troubleshooting Failed Domain', troubleIntro: 'Please try the following:',
    trouble1: 'Verify that the CNAME record has been added to your DNS provider',
    trouble2: 'Wait a few minutes and click "Retry" - DNS changes can take 5-60 minutes to propagate',
    trouble3: 'Check that the CNAME points to exactly:',
    trouble4: 'Ensure there are no typos in the domain name or CNAME target',
    trouble5: 'If the error mentions "not configured", Netlify credentials need to be set up - contact support',
    dnsRequired: 'DNS Configuration Required', dnsIntro: 'Add the following CNAME record to your DNS provider:',
    colType: 'Type', colName: 'Name', colValue: 'Value', copied: 'Copied!', copy: 'Copy',
    dnsNote1: 'DNS changes can take up to 48 hours to propagate, but usually happen within a few minutes.',
    dnsNote2: 'Once verified, Netlify will automatically provision an SSL certificate for HTTPS.',
    domainActive: 'Domain Active', domainActiveBody: 'Your domain is properly configured and your booking site is accessible at',
    stepsTitle: 'Setup Process',
    step1Title: 'Add Your Domain', step1Body: 'Enter your custom domain (e.g., booking.yourdomain.com)',
    step2Title: 'Configure DNS', step2Body: 'Add a CNAME record at your domain registrar pointing to {target}',
    step3Title: 'Verify DNS', step3Body: 'Wait a few minutes and click "Verify" - DNS changes can take 5-60 minutes',
    step4Title: 'Platform Configuration', step4Body: 'Your domain is automatically added to our platform after DNS verification',
    step5Title: 'SSL Certificate', step5Body: 'SSL certificate is provisioned automatically (5-15 minutes) - your domain will be live with HTTPS',
  },
  de: {
    upgradeFailed: 'Upgrade konnte nicht gestartet werden. Bitte erneut versuchen oder den Support kontaktieren.',
    enterDomain: 'Bitte eine Domain eingeben', invalidDomain: 'Bitte eine gültige Domain eingeben (z. B. bookings.example.com)', domainExists: 'Diese Domain wurde bereits hinzugefügt',
    addFailed: 'Domain konnte nicht hinzugefügt werden. Bitte erneut versuchen.',
    verifyFailed: 'Prüfung fehlgeschlagen: {error}',
    verifySuccess: 'Domain erfolgreich geprüft. Die Domain wird jetzt eingerichtet, das SSL-Zertifikat folgt in 5–15 Minuten.',
    dnsNotReady: 'DNS noch nicht eingerichtet: {reason}', dnsNotReadyDefault: 'Bitte DNS-Einstellungen prüfen und sicherstellen, dass der CNAME-Eintrag stimmt.',
    verifyError: 'Domain konnte nicht geprüft werden: {error}', unknownError: 'Unbekannter Fehler',
    setPrimaryFailed: 'Hauptdomain konnte nicht festgelegt werden.',
    confirmRemove: '{domain} wirklich entfernen? Die Domain wird aus Netlify und der Datenbank gelöscht.',
    removeFailedReason: 'Domain konnte nicht entfernt werden: {error}', removed: 'Domain entfernt', removeFailed: 'Domain konnte nicht entfernt werden. Bitte erneut versuchen.',
    badgeActive: 'Aktiv', badgeProvisioning: 'Wird eingerichtet', badgeDnsVerified: 'DNS geprüft', badgeFailed: 'Fehlgeschlagen', badgePendingDns: 'DNS ausstehend',
    sslActive: 'SSL aktiv', sslProvisioning: 'SSL wird eingerichtet', sslFailed: 'SSL fehlgeschlagen', sslPending: 'SSL ausstehend',
    proTitle: 'Eigene Domain – Pro-Funktion',
    proBody: 'Mit einer eigenen Domain wirkt die Buchungsseite komplett in Ihrem Markenauftritt. Mit Pro werden eigene Domains inklusive automatischem SSL-Zertifikat freigeschaltet.',
    processing: 'Wird verarbeitet…', upgrade: 'Auf Pro upgraden →',
    whyTitle: 'Warum eine eigene Domain?',
    why1: 'Professioneller Auftritt mit eigener Marke (z. B. bookings.ihrbetrieb.de)', why2: 'Schafft Vertrauen bei Ihren Kunden',
    why3: 'Automatisches SSL-Zertifikat für sichere HTTPS-Verbindungen', why4: 'Besser für SEO und leichter zu merken',
    loading: 'Domains werden geladen…', setupTitle: 'Eigene Domain einrichten',
    setupBody: 'Mit einer eigenen Domain wirkt die Buchungsseite komplett in Ihrem Markenauftritt. Domain hinzufügen, DNS einrichten – das SSL-Zertifikat erstellen wir automatisch über Netlify.',
    addTitle: 'Eigene Domain hinzufügen', adding: 'Wird hinzugefügt…', addDomain: 'Domain hinzufügen',
    addHint: 'Subdomain eingeben, z. B. „bookings.ihredomain.de“ oder „book.ihredomain.de“',
    yourDomains: 'Ihre Domains', primary: 'Hauptdomain', dnsErrorTitle: 'Fehler bei der DNS-Prüfung', platformErrorTitle: 'Fehler bei der Plattform-Einrichtung',
    netlifyNotConfigured: 'Netlify-Zugangsdaten sind nicht eingerichtet. Bitte den Support kontaktieren.',
    verifiedOn: 'DNS geprüft: {date}', addedOn: 'Eingerichtet: {date}', lastChecked: 'Zuletzt geprüft: {date}',
    addingTitle: 'Domain wird eingerichtet…', addingBody: 'Das dauert meist 5–15 Minuten. Das SSL-Zertifikat wird automatisch erstellt.',
    setPrimary: 'Als Hauptdomain festlegen', retrying: 'Wird erneut geprüft…', retry: 'Erneut prüfen', checking: 'Wird geprüft…', verify: 'Prüfen', removeDomain: 'Domain entfernen',
    troubleTitle: 'Fehlerbehebung', troubleIntro: 'Bitte Folgendes versuchen:',
    trouble1: 'Prüfen, ob der CNAME-Eintrag beim DNS-Anbieter angelegt ist',
    trouble2: 'Einige Minuten warten und auf „Erneut prüfen“ klicken – DNS-Änderungen brauchen 5–60 Minuten',
    trouble3: 'Prüfen, ob der CNAME exakt hierauf zeigt:',
    trouble4: 'Domainname und CNAME-Ziel auf Tippfehler prüfen',
    trouble5: 'Erwähnt der Fehler „not configured“, müssen Netlify-Zugangsdaten eingerichtet werden – bitte den Support kontaktieren',
    dnsRequired: 'DNS-Einrichtung erforderlich', dnsIntro: 'Diesen CNAME-Eintrag beim DNS-Anbieter anlegen:',
    colType: 'Typ', colName: 'Name', colValue: 'Wert', copied: 'Kopiert', copy: 'Kopieren',
    dnsNote1: 'DNS-Änderungen können bis zu 48 Stunden dauern, meist geht es in wenigen Minuten.',
    dnsNote2: 'Nach der Prüfung erstellt Netlify automatisch ein SSL-Zertifikat für HTTPS.',
    domainActive: 'Domain aktiv', domainActiveBody: 'Die Domain ist korrekt eingerichtet. Ihre Buchungsseite ist erreichbar unter',
    stepsTitle: 'Ablauf',
    step1Title: 'Domain hinzufügen', step1Body: 'Eigene Domain eingeben (z. B. booking.ihredomain.de)',
    step2Title: 'DNS einrichten', step2Body: 'Beim Domain-Anbieter einen CNAME-Eintrag anlegen, der auf {target} zeigt',
    step3Title: 'DNS prüfen', step3Body: 'Einige Minuten warten und auf „Prüfen“ klicken – DNS-Änderungen brauchen 5–60 Minuten',
    step4Title: 'Plattform-Einrichtung', step4Body: 'Nach der DNS-Prüfung wird die Domain automatisch auf unserer Plattform eingerichtet',
    step5Title: 'SSL-Zertifikat', step5Body: 'Das SSL-Zertifikat wird automatisch erstellt (5–15 Minuten) – danach ist die Domain per HTTPS erreichbar',
  },
  th: {
    upgradeFailed: 'เริ่มการอัปเกรดไม่สำเร็จ กรุณาลองอีกครั้งหรือติดต่อฝ่ายสนับสนุน',
    enterDomain: 'กรุณาใส่โดเมน', invalidDomain: 'กรุณาใส่โดเมนที่ถูกต้อง (เช่น bookings.example.com)', domainExists: 'เพิ่มโดเมนนี้ไว้แล้ว',
    addFailed: 'เพิ่มโดเมนไม่สำเร็จ กรุณาลองอีกครั้ง',
    verifyFailed: 'ตรวจสอบไม่สำเร็จ: {error}',
    verifySuccess: 'ตรวจสอบโดเมนสำเร็จ ระบบกำลังเพิ่มโดเมนเข้าแพลตฟอร์ม และจะออกใบรับรอง SSL ภายใน 5–15 นาที',
    dnsNotReady: 'ยังไม่ได้ตั้งค่า DNS: {reason}', dnsNotReadyDefault: 'กรุณาตรวจสอบการตั้งค่า DNS และระเบียน CNAME ให้ถูกต้อง',
    verifyError: 'ตรวจสอบโดเมนไม่สำเร็จ: {error}', unknownError: 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ',
    setPrimaryFailed: 'ตั้งเป็นโดเมนหลักไม่สำเร็จ',
    confirmRemove: 'ต้องการลบ {domain} หรือไม่ โดเมนจะถูกลบออกจาก Netlify และฐานข้อมูล',
    removeFailedReason: 'ลบโดเมนไม่สำเร็จ: {error}', removed: 'ลบโดเมนแล้ว', removeFailed: 'ลบโดเมนไม่สำเร็จ กรุณาลองอีกครั้ง',
    badgeActive: 'ใช้งานอยู่', badgeProvisioning: 'กำลังเพิ่มเข้าแพลตฟอร์ม', badgeDnsVerified: 'ตรวจสอบ DNS แล้ว', badgeFailed: 'ไม่สำเร็จ', badgePendingDns: 'รอ DNS',
    sslActive: 'SSL ใช้งานอยู่', sslProvisioning: 'กำลังออก SSL', sslFailed: 'SSL ไม่สำเร็จ', sslPending: 'รอ SSL',
    proTitle: 'โดเมนของร้าน – ฟีเจอร์ Pro',
    proBody: 'เชื่อมต่อโดเมนของร้านเองเพื่อให้หน้าจองเป็นแบรนด์ของคุณเต็มรูปแบบ อัปเกรดเป็น Pro เพื่อใช้โดเมนของร้านพร้อมใบรับรอง SSL อัตโนมัติ',
    processing: 'กำลังดำเนินการ…', upgrade: 'อัปเกรดเป็น Pro →',
    whyTitle: 'ทำไมต้องใช้โดเมนของร้าน',
    why1: 'ดูเป็นมืออาชีพด้วยแบรนด์ของคุณเอง (เช่น bookings.yourbusiness.com)', why2: 'สร้างความน่าเชื่อถือให้ลูกค้า',
    why3: 'ใบรับรอง SSL อัตโนมัติสำหรับการเชื่อมต่อ HTTPS ที่ปลอดภัย', why4: 'ดีต่อ SEO และจำง่ายกว่า',
    loading: 'กำลังโหลดโดเมน…', setupTitle: 'ตั้งค่าโดเมนของร้าน',
    setupBody: 'เชื่อมต่อโดเมนของร้านเองเพื่อให้หน้าจองเป็นแบรนด์ของคุณเต็มรูปแบบ เพิ่มโดเมน ตั้งค่า DNS แล้วระบบจะจัดการใบรับรอง SSL ให้อัตโนมัติผ่าน Netlify',
    addTitle: 'เพิ่มโดเมนของร้าน', adding: 'กำลังเพิ่ม…', addDomain: 'เพิ่มโดเมน',
    addHint: 'ใส่ซับโดเมน เช่น "bookings.yourdomain.com" หรือ "book.yourdomain.com"',
    yourDomains: 'โดเมนของคุณ', primary: 'โดเมนหลัก', dnsErrorTitle: 'ตรวจสอบ DNS ผิดพลาด', platformErrorTitle: 'เชื่อมต่อแพลตฟอร์มผิดพลาด',
    netlifyNotConfigured: 'ยังไม่ได้ตั้งค่าข้อมูลเข้าใช้ Netlify กรุณาติดต่อฝ่ายสนับสนุน',
    verifiedOn: 'ตรวจสอบ DNS แล้ว: {date}', addedOn: 'เพิ่มเข้าแพลตฟอร์มแล้ว: {date}', lastChecked: 'ตรวจสอบล่าสุด: {date}',
    addingTitle: 'กำลังเพิ่มโดเมนเข้าแพลตฟอร์ม…', addingBody: 'โดยปกติใช้เวลา 5–15 นาที ระบบจะออกใบรับรอง SSL ให้อัตโนมัติ',
    setPrimary: 'ตั้งเป็นโดเมนหลัก', retrying: 'กำลังลองใหม่…', retry: 'ลองใหม่', checking: 'กำลังตรวจสอบ…', verify: 'ตรวจสอบ', removeDomain: 'ลบโดเมน',
    troubleTitle: 'แก้ปัญหาโดเมนที่ไม่สำเร็จ', troubleIntro: 'กรุณาลองทำตามนี้:',
    trouble1: 'ตรวจสอบว่าได้เพิ่มระเบียน CNAME ที่ผู้ให้บริการ DNS แล้ว',
    trouble2: 'รอสักครู่แล้วกด "ลองใหม่" การเปลี่ยน DNS อาจใช้เวลา 5–60 นาที',
    trouble3: 'ตรวจสอบว่า CNAME ชี้ไปที่ค่านี้ตรงทุกตัวอักษร:',
    trouble4: 'ตรวจสอบว่าไม่มีการพิมพ์ผิดในชื่อโดเมนหรือปลายทาง CNAME',
    trouble5: 'ถ้าข้อผิดพลาดมีคำว่า "not configured" ต้องตั้งค่าข้อมูลเข้าใช้ Netlify กรุณาติดต่อฝ่ายสนับสนุน',
    dnsRequired: 'ต้องตั้งค่า DNS', dnsIntro: 'เพิ่มระเบียน CNAME ต่อไปนี้ที่ผู้ให้บริการ DNS:',
    colType: 'ประเภท', colName: 'ชื่อ', colValue: 'ค่า', copied: 'คัดลอกแล้ว', copy: 'คัดลอก',
    dnsNote1: 'การเปลี่ยน DNS อาจใช้เวลาถึง 48 ชั่วโมง แต่ส่วนใหญ่จะเสร็จภายในไม่กี่นาที',
    dnsNote2: 'เมื่อตรวจสอบแล้ว Netlify จะออกใบรับรอง SSL สำหรับ HTTPS ให้อัตโนมัติ',
    domainActive: 'โดเมนใช้งานอยู่', domainActiveBody: 'ตั้งค่าโดเมนถูกต้องแล้ว หน้าจองของคุณเข้าได้ที่',
    stepsTitle: 'ขั้นตอนการตั้งค่า',
    step1Title: 'เพิ่มโดเมน', step1Body: 'ใส่โดเมนของร้าน (เช่น booking.yourdomain.com)',
    step2Title: 'ตั้งค่า DNS', step2Body: 'เพิ่มระเบียน CNAME ที่ผู้ให้บริการโดเมน โดยชี้ไปที่ {target}',
    step3Title: 'ตรวจสอบ DNS', step3Body: 'รอสักครู่แล้วกด "ตรวจสอบ" การเปลี่ยน DNS อาจใช้เวลา 5–60 นาที',
    step4Title: 'ตั้งค่าแพลตฟอร์ม', step4Body: 'ระบบจะเพิ่มโดเมนเข้าแพลตฟอร์มให้อัตโนมัติหลังตรวจสอบ DNS',
    step5Title: 'ใบรับรอง SSL', step5Body: 'ระบบออกใบรับรอง SSL ให้อัตโนมัติ (5–15 นาที) จากนั้นโดเมนจะใช้งานผ่าน HTTPS ได้',
  },
};

interface CustomDomain {
  id: string;
  domain: string;
  status: 'pending' | 'verified' | 'failed' | 'provisioning' | 'active';
  dns_configured: boolean;
  ssl_status: string;
  ssl_certificate_status: 'pending' | 'provisioning' | 'active' | 'failed';
  verified_at: string | null;
  last_checked_at: string | null;
  error_message: string | null;
  netlify_api_error: string | null;
  netlify_domain_id: string | null;
  provisioned_at: string | null;
  is_primary: boolean;
  created_at: string;
}

export default function CustomDomainSettings() {
  const { businessId } = useTenant();
  const premiumFeatures = usePremiumFeatures();
  const { t, locale } = useAdminText(TEXT);
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [verifying, setVerifying] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [netlifyUrl, setNetlifyUrl] = useState('');
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    fetchDomains();
    fetchNetlifyUrl();
  }, [businessId]);

  const fetchNetlifyUrl = async () => {
    // Get Netlify URL from environment or settings
    const url = import.meta.env.VITE_NETLIFY_SITE_URL || window.location.hostname;
    setNetlifyUrl(url);
  };

  const fetchDomains = async () => {
    if (!businessId) return;

    const { data, error } = await supabase
      .from('custom_domains')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDomains(data);
    }
    setLoading(false);
  };

  const handleUpgrade = async () => {
    if (upgrading || !businessId) return;

    setUpgrading(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upgrade-subscription`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await adminAccessToken()}`,
        },
        body: JSON.stringify({
          business_id: businessId,
          plan_type: 'pro',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Stripe checkout error:', errorData);
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
      setUpgrading(false);
    }
  };

  const validateDomain = (domain: string): string | null => {
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

    if (!domain) {
      return t.enterDomain;
    }

    if (!domainRegex.test(domain)) {
      return t.invalidDomain;
    }

    // Check if domain already exists
    if (domains.some(d => d.domain.toLowerCase() === domain.toLowerCase())) {
      return t.domainExists;
    }

    return null;
  };

  const handleAddDomain = async () => {
    if (!businessId || !premiumFeatures.canUseCustomDomain) return;

    const error = validateDomain(newDomain);
    if (error) {
      alert(error);
      return;
    }

    setAdding(true);

    try {
      const { data, error: insertError } = await supabase
        .from('custom_domains')
        .insert({
          business_id: businessId,
          domain: newDomain.toLowerCase().trim(),
          status: 'pending',
          dns_configured: false,
          ssl_status: 'pending',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setDomains([data, ...domains]);
      setNewDomain('');
      setShowInstructions(true);
    } catch (error) {
      console.error('Error adding domain:', error);
      alert(t.addFailed);
    } finally {
      setAdding(false);
    }
  };

  const handleVerifyDomain = async (domainId: string) => {
    setVerifying(domainId);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-custom-domain`;

      console.log(`[CustomDomainSettings] Verifying domain: ${domainId}`);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await adminAccessToken()}`,
        },
        body: JSON.stringify({ domain_id: domainId }),
      });

      const result = await response.json();

      console.log('[CustomDomainSettings] Verification result:', result);

      if (result.error) {
        const errorMessage = result.details ? `${result.error}: ${result.details}` : result.error;
        console.error('[CustomDomainSettings] Verification error:', errorMessage);
        alert(fillText(t.verifyFailed, { error: errorMessage }));
      } else if (result.configured) {
        alert(t.verifySuccess);
      } else {
        alert(fillText(t.dnsNotReady, { reason: result.error || t.dnsNotReadyDefault }));
      }

      await fetchDomains();
    } catch (error) {
      console.error('Error verifying domain:', error);
      const errorMessage = error instanceof Error ? error.message : t.unknownError;
      alert(fillText(t.verifyError, { error: errorMessage }));
    } finally {
      setVerifying(null);
    }
  };

  const handleSetPrimary = async (domainId: string) => {
    try {
      const { error } = await supabase
        .from('custom_domains')
        .update({ is_primary: true })
        .eq('id', domainId);

      if (error) throw error;

      await fetchDomains();
    } catch (error) {
      console.error('Error setting primary domain:', error);
      alert(t.setPrimaryFailed);
    }
  };

  const handleRemoveDomain = async (domainId: string, domain: string) => {
    if (!confirm(fillText(t.confirmRemove, { domain }))) {
      return;
    }

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/remove-domain-from-netlify`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await adminAccessToken()}`,
        },
        body: JSON.stringify({ domain_id: domainId }),
      });

      const result = await response.json();

      if (!result.success) {
        alert(fillText(t.removeFailedReason, { error: result.error }));
        return;
      }

      setDomains(domains.filter(d => d.id !== domainId));
      alert(t.removed);
    } catch (error) {
      console.error('Error removing domain:', error);
      alert(t.removeFailed);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getStatusBadge = (domain: CustomDomain) => {
    if (domain.status === 'active' || (domain.status === 'verified' && domain.ssl_certificate_status === 'active')) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
          <Check className="w-3 h-3" />
          <span>{t.badgeActive}</span>
        </span>
      );
    }

    if (domain.status === 'provisioning') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>{t.badgeProvisioning}</span>
        </span>
      );
    }

    if (domain.status === 'verified' && domain.dns_configured) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
          <Check className="w-3 h-3" />
          <span>{t.badgeDnsVerified}</span>
        </span>
      );
    }

    if (domain.status === 'failed') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
          <X className="w-3 h-3" />
          <span>{t.badgeFailed}</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center space-x-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded">
        <AlertCircle className="w-3 h-3" />
        <span>{t.badgePendingDns}</span>
      </span>
    );
  };

  const getSSLBadge = (domain: CustomDomain) => {
    if (domain.ssl_certificate_status === 'active') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
          <Check className="w-3 h-3" />
          <span>{t.sslActive}</span>
        </span>
      );
    }

    if (domain.ssl_certificate_status === 'provisioning') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>{t.sslProvisioning}</span>
        </span>
      );
    }

    if (domain.ssl_certificate_status === 'failed') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
          <X className="w-3 h-3" />
          <span>{t.sslFailed}</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center space-x-1 px-2 py-1 bg-stone-100 text-stone-600 text-xs font-medium rounded">
        <AlertCircle className="w-3 h-3" />
        <span>{t.sslPending}</span>
      </span>
    );
  };

  if (!premiumFeatures.canUseCustomDomain) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-lg p-8 text-center">
          <Crown className="w-16 h-16 text-amber-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-amber-900 mb-2">{t.proTitle}</h3>
          <p className="text-amber-800 mb-6">
            {t.proBody}
          </p>
          <button
            onClick={handleUpgrade}
            disabled={upgrading}
            className="px-6 py-3 bg-amber-600 text-white font-semibold rounded hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {upgrading ? t.processing : t.upgrade}
          </button>
        </div>

        <div className="bg-white border border-stone-200 rounded-lg p-6">
          <h4 className="font-medium text-stone-800 mb-4">{t.whyTitle}</h4>
          <ul className="space-y-3 text-sm text-stone-600">
            <li className="flex items-start space-x-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>{t.why1}</span>
            </li>
            <li className="flex items-start space-x-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>{t.why2}</span>
            </li>
            <li className="flex items-start space-x-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>{t.why3}</span>
            </li>
            <li className="flex items-start space-x-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>{t.why4}</span>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="text-stone-600">{t.loading}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Globe className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900">{t.setupTitle}</h3>
            <p className="text-sm text-blue-800 mt-1">
              {t.setupBody}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-stone-800 mb-4">{t.addTitle}</h3>

        <div className="flex space-x-2 mb-4">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
            placeholder="bookings.yourdomain.com"
            className="flex-1 px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
          />
          <button
            onClick={handleAddDomain}
            disabled={adding || !newDomain.trim()}
            className="flex items-center space-x-2 px-6 py-2 bg-stone-800 text-white rounded hover:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            <span>{adding ? t.adding : t.addDomain}</span>
          </button>
        </div>

        <p className="text-xs text-stone-500">
          {t.addHint}
        </p>
      </div>

      {domains.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-stone-200">
            <h3 className="text-lg font-medium text-stone-800">{t.yourDomains}</h3>
          </div>

          <div className="divide-y divide-stone-200">
            {domains.map((domain) => (
              <div key={domain.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-lg font-medium text-stone-800">{domain.domain}</h4>
                      {getStatusBadge(domain)}
                      {domain.netlify_domain_id && getSSLBadge(domain)}
                      {domain.is_primary && (
                        <span className="px-2 py-1 bg-stone-800 text-white text-xs font-medium rounded">
                          {t.primary}
                        </span>
                      )}
                    </div>

                    {domain.error_message && (
                      <div className="flex items-start space-x-2 text-sm text-red-600 mb-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium">{t.dnsErrorTitle}</p>
                          <p className="text-xs mt-1">{domain.error_message}</p>
                        </div>
                      </div>
                    )}

                    {domain.netlify_api_error && (
                      <div className="flex items-start space-x-2 text-sm text-red-600 mb-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium">{t.platformErrorTitle}</p>
                          <p className="text-xs mt-1">
                            {domain.netlify_api_error.includes('not configured')
                              ? t.netlifyNotConfigured
                              : domain.netlify_api_error}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="text-sm text-stone-600 space-y-1">
                      {domain.verified_at && (
                        <p>{fillText(t.verifiedOn, { date: new Date(domain.verified_at).toLocaleDateString(locale) })}</p>
                      )}
                      {domain.provisioned_at && (
                        <p>{fillText(t.addedOn, { date: new Date(domain.provisioned_at).toLocaleDateString(locale) })}</p>
                      )}
                      {domain.last_checked_at && (
                        <p className="text-xs">
                          {fillText(t.lastChecked, { date: new Date(domain.last_checked_at).toLocaleString(locale) })}
                        </p>
                      )}
                    </div>

                    {domain.status === 'provisioning' && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                        <div className="flex items-start space-x-2">
                          <RefreshCw className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5 animate-spin" />
                          <div className="text-sm text-blue-800">
                            <p className="font-medium">{t.addingTitle}</p>
                            <p className="mt-1 text-xs">{t.addingBody}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {domain.status === 'verified' && !domain.is_primary && (
                      <button
                        onClick={() => handleSetPrimary(domain.id)}
                        className="px-3 py-1 text-sm border border-stone-300 text-stone-700 rounded hover:bg-stone-50"
                      >
                        {t.setPrimary}
                      </button>
                    )}
                    {domain.status === 'failed' ? (
                      <button
                        onClick={() => handleVerifyDomain(domain.id)}
                        disabled={verifying === domain.id}
                        className="flex items-center space-x-1 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${verifying === domain.id ? 'animate-spin' : ''}`} />
                        <span>{verifying === domain.id ? t.retrying : t.retry}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleVerifyDomain(domain.id)}
                        disabled={verifying === domain.id}
                        className="flex items-center space-x-1 px-3 py-1 text-sm bg-stone-800 text-white rounded hover:bg-stone-700 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${verifying === domain.id ? 'animate-spin' : ''}`} />
                        <span>{verifying === domain.id ? t.checking : t.verify}</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveDomain(domain.id, domain.domain)}
                      aria-label={t.removeDomain}
                      title={t.removeDomain}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {domain.status === 'failed' && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
                    <h5 className="font-medium text-red-800 mb-3 flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4" />
                      <span>{t.troubleTitle}</span>
                    </h5>
                    <div className="text-sm text-red-700 space-y-2">
                      <p className="font-medium">{t.troubleIntro}</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>{t.trouble1}</li>
                        <li>{t.trouble2}</li>
                        <li>{t.trouble3} <code className="bg-red-100 px-1 rounded">{netlifyUrl}</code></li>
                        <li>{t.trouble4}</li>
                        <li>{t.trouble5}</li>
                      </ul>
                    </div>
                  </div>
                )}

                {domain.status !== 'verified' && domain.status !== 'failed' && (
                  <div className="mt-4 p-4 bg-stone-50 border border-stone-200 rounded">
                    <h5 className="font-medium text-stone-800 mb-3 flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4" />
                      <span>{t.dnsRequired}</span>
                    </h5>

                    <p className="text-sm text-stone-600 mb-3">
                      {t.dnsIntro}
                    </p>

                    <div className="bg-white border border-stone-200 rounded overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-stone-100">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium text-stone-700">{t.colType}</th>
                            <th className="px-4 py-2 text-left font-medium text-stone-700">{t.colName}</th>
                            <th className="px-4 py-2 text-left font-medium text-stone-700">{t.colValue}</th>
                            <th className="px-4 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="px-4 py-3 border-t border-stone-200">
                              <code className="px-2 py-1 bg-stone-100 rounded text-xs">CNAME</code>
                            </td>
                            <td className="px-4 py-3 border-t border-stone-200">
                              <code className="text-xs">{domain.domain.split('.')[0]}</code>
                            </td>
                            <td className="px-4 py-3 border-t border-stone-200">
                              <code className="text-xs">{netlifyUrl}</code>
                            </td>
                            <td className="px-4 py-3 border-t border-stone-200 text-right">
                              <button
                                onClick={() => copyToClipboard(netlifyUrl, `cname-${domain.id}`)}
                                className="flex items-center space-x-1 text-xs text-stone-600 hover:text-stone-800"
                              >
                                {copiedField === `cname-${domain.id}` ? (
                                  <>
                                    <Check className="w-3 h-3" />
                                    <span>{t.copied}</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>{t.copy}</span>
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-3 text-xs text-stone-600 space-y-1">
                      <p className="flex items-start space-x-2">
                        <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span>{t.dnsNote1}</span>
                      </p>
                      <p className="flex items-start space-x-2">
                        <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span>{t.dnsNote2}</span>
                      </p>
                    </div>
                  </div>
                )}

                {domain.status === 'verified' && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
                    <div className="flex items-start space-x-2 text-sm text-green-800">
                      <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">{t.domainActive}</p>
                        <p className="mt-1">
                          {t.domainActiveBody}{' '}
                          <a
                            href={`https://${domain.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 underline hover:no-underline"
                          >
                            <span>https://{domain.domain}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-stone-50 border border-stone-200 rounded-lg p-6">
        <h4 className="font-medium text-stone-800 mb-3">{t.stepsTitle}</h4>
        <div className="text-sm text-stone-600 space-y-3">
          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-6 h-6 bg-stone-800 text-white rounded-full flex items-center justify-center text-xs font-medium">1</span>
            <div>
              <p className="font-medium text-stone-800">{t.step1Title}</p>
              <p className="text-xs mt-1">{t.step1Body}</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-6 h-6 bg-stone-800 text-white rounded-full flex items-center justify-center text-xs font-medium">2</span>
            <div>
              <p className="font-medium text-stone-800">{t.step2Title}</p>
              <p className="text-xs mt-1">{fillText(t.step2Body, { target: netlifyUrl })}</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-6 h-6 bg-stone-800 text-white rounded-full flex items-center justify-center text-xs font-medium">3</span>
            <div>
              <p className="font-medium text-stone-800">{t.step3Title}</p>
              <p className="text-xs mt-1">{t.step3Body}</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-6 h-6 bg-stone-800 text-white rounded-full flex items-center justify-center text-xs font-medium">4</span>
            <div>
              <p className="font-medium text-stone-800">{t.step4Title}</p>
              <p className="text-xs mt-1">{t.step4Body}</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="flex-shrink-0 w-6 h-6 bg-stone-800 text-white rounded-full flex items-center justify-center text-xs font-medium">5</span>
            <div>
              <p className="font-medium text-stone-800">{t.step5Title}</p>
              <p className="text-xs mt-1">{t.step5Body}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
