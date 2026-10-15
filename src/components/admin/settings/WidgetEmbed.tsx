import { useState, useEffect } from 'react';
import { Code, Copy, Check, ExternalLink, Monitor, MessageSquare, Layout, Palette, Crown, Lock } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';
import { supabase } from '../../../lib/supabase';
import { usePremiumFeatures } from '../../../hooks/usePremiumFeatures';
import { BRAND_NAME } from '../../../lib/brand';
import { shopUrl } from '../../../lib/tenantHost';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText, type Translations } from '../../../lib/bookingLanguage';

const TEXT: Translations<{
  floatingName: string; floatingDesc: string; fullPageName: string; fullPageDesc: string; inlineName: string; inlineDesc: string;
  loading: string; premiumTitle: string; premiumBody: string; proPlan: string; typesWithPro: string;
  notFoundTitle: string; notFoundBefore: string; profileName: string; notFoundAfter: string; notFoundRefresh: string;
  manualTitle: string; manualHint: string;
  heading: string; intro: string; widgetType: string; buttonCustomization: string; buttonText: string; position: string;
  bottomRight: string; bottomLeft: string; topRight: string; topLeft: string; buttonColor: string; textColor: string; preview: string;
  sizeConfig: string; width: string; widthHint: string; height: string; heightHint: string;
  embedCode: string; copied: string; copyCode: string; directLink: string; directLinkHint: string; copyLink: string; openLink: string;
  howTo: string; step1: string; step2: string; step3: string; step4: string; step5Before: string; step5After: string;
}> = {
  en: {
    floatingName: 'Floating Button', floatingDesc: 'A button that floats on the page and opens a booking popup',
    fullPageName: 'Full Page Embed', fullPageDesc: 'Embed the full booking page directly on your website',
    inlineName: 'Inline Widget', inlineDesc: 'A compact widget that fits within your page content',
    loading: 'Loading...', premiumTitle: 'Premium Feature',
    premiumBody: 'Embeddable widgets allow you to add booking functionality directly to your website. Upgrade to Pro to unlock this feature.',
    proPlan: 'Available on Pro Plan', typesWithPro: 'Widget Types Available with Pro:',
    notFoundTitle: 'Booking URL Not Found', notFoundBefore: "We couldn't find your booking page URL. Please ensure your subdomain is configured in ",
    profileName: 'Store Profile', notFoundAfter: '.', notFoundRefresh: "If you've already set up your subdomain, try refreshing the page.",
    manualTitle: 'Enter Your Booking URL Manually', manualHint: 'Enter your full booking page URL (e.g., {example})',
    heading: 'Embed Booking Widget', intro: 'Add a booking widget to your website. Choose from different styles and customize the appearance.',
    widgetType: 'Widget Type', buttonCustomization: 'Button Customization', buttonText: 'Button Text', position: 'Position',
    bottomRight: 'Bottom Right', bottomLeft: 'Bottom Left', topRight: 'Top Right', topLeft: 'Top Left',
    buttonColor: 'Button Color', textColor: 'Text Color', preview: 'Preview',
    sizeConfig: 'Size Configuration', width: 'Width', widthHint: 'e.g., 100%, 600px, 80vw', height: 'Height', heightHint: 'e.g., 700px, 80vh',
    embedCode: 'Embed Code', copied: 'Copied!', copyCode: 'Copy Code', directLink: 'Direct Booking Link', directLinkHint: 'Share this link directly with your customers:',
    copyLink: 'Copy link', openLink: 'Open booking page',
    howTo: 'How to Use', step1: 'Choose your preferred widget type above', step2: 'Customize the appearance if needed',
    step3: 'Copy the embed code using the "Copy Code" button', step4: "Paste the code into your website's HTML where you want the widget to appear",
    step5Before: 'For the floating button, paste it just before the closing', step5After: ' tag',
  },
  de: {
    floatingName: 'Schwebender Button', floatingDesc: 'Ein Button, der über der Seite schwebt und die Buchung als Popup öffnet',
    fullPageName: 'Ganze Seite einbinden', fullPageDesc: 'Die komplette Buchungsseite direkt auf Ihrer Website einbinden',
    inlineName: 'Inline-Widget', inlineDesc: 'Ein kompaktes Widget, das sich in Ihre Seiteninhalte einfügt',
    loading: 'Wird geladen…', premiumTitle: 'Premium-Funktion',
    premiumBody: 'Mit einbettbaren Widgets lässt sich die Buchung direkt auf Ihrer Website anbieten. Mit Pro wird diese Funktion freigeschaltet.',
    proPlan: 'Im Pro-Tarif enthalten', typesWithPro: 'Widget-Typen mit Pro:',
    notFoundTitle: 'Buchungs-URL nicht gefunden', notFoundBefore: 'Die URL Ihrer Buchungsseite wurde nicht gefunden. Bitte prüfen, ob die Subdomain unter ',
    profileName: 'Shop-Profil', notFoundAfter: ' eingerichtet ist.', notFoundRefresh: 'Ist die Subdomain bereits eingerichtet, die Seite bitte neu laden.',
    manualTitle: 'Buchungs-URL manuell eingeben', manualHint: 'Vollständige URL der Buchungsseite eingeben (z. B. {example})',
    heading: 'Widget einbinden', intro: 'Ein Buchungs-Widget auf Ihrer Website einbinden. Stil wählen und Darstellung anpassen.',
    widgetType: 'Widget-Typ', buttonCustomization: 'Button anpassen', buttonText: 'Button-Text', position: 'Position',
    bottomRight: 'Unten rechts', bottomLeft: 'Unten links', topRight: 'Oben rechts', topLeft: 'Oben links',
    buttonColor: 'Button-Farbe', textColor: 'Textfarbe', preview: 'Vorschau',
    sizeConfig: 'Größe', width: 'Breite', widthHint: 'z. B. 100%, 600px, 80vw', height: 'Höhe', heightHint: 'z. B. 700px, 80vh',
    embedCode: 'Einbettungscode', copied: 'Kopiert', copyCode: 'Code kopieren', directLink: 'Direkter Buchungslink', directLinkHint: 'Diesen Link direkt an Ihre Kunden weitergeben:',
    copyLink: 'Link kopieren', openLink: 'Buchungsseite öffnen',
    howTo: 'Anleitung', step1: 'Oben den gewünschten Widget-Typ wählen', step2: 'Bei Bedarf die Darstellung anpassen',
    step3: 'Den Einbettungscode über „Code kopieren“ kopieren', step4: 'Den Code an der gewünschten Stelle in das HTML Ihrer Website einfügen',
    step5Before: 'Beim schwebenden Button den Code direkt vor dem schließenden', step5After: '-Tag einfügen',
  },
  th: {
    floatingName: 'ปุ่มลอย', floatingDesc: 'ปุ่มที่ลอยอยู่บนหน้าเว็บ กดแล้วเปิดหน้าจองแบบป๊อปอัป',
    fullPageName: 'ฝังทั้งหน้า', fullPageDesc: 'ฝังหน้าจองทั้งหน้าลงในเว็บไซต์ของคุณโดยตรง',
    inlineName: 'วิดเจ็ตในเนื้อหา', inlineDesc: 'วิดเจ็ตขนาดกะทัดรัดที่แทรกอยู่ในเนื้อหาของหน้า',
    loading: 'กำลังโหลด…', premiumTitle: 'ฟีเจอร์พรีเมียม',
    premiumBody: 'วิดเจ็ตแบบฝังช่วยให้ลูกค้าจองได้โดยตรงจากเว็บไซต์ของคุณ อัปเกรดเป็น Pro เพื่อใช้ฟีเจอร์นี้',
    proPlan: 'มีในแพ็กเกจ Pro', typesWithPro: 'ประเภทวิดเจ็ตที่ใช้ได้ในแพ็กเกจ Pro:',
    notFoundTitle: 'ไม่พบ URL หน้าจอง', notFoundBefore: 'ไม่พบ URL หน้าจองของคุณ กรุณาตรวจสอบว่าได้ตั้งค่าซับโดเมนใน ',
    profileName: 'ข้อมูลร้าน', notFoundAfter: ' แล้ว', notFoundRefresh: 'ถ้าตั้งค่าซับโดเมนไว้แล้ว ลองรีเฟรชหน้านี้',
    manualTitle: 'ใส่ URL หน้าจองเอง', manualHint: 'ใส่ URL หน้าจองแบบเต็ม (เช่น {example})',
    heading: 'ฝังวิดเจ็ต', intro: 'เพิ่มวิดเจ็ตจองลงในเว็บไซต์ของคุณ เลือกรูปแบบและปรับการแสดงผลได้',
    widgetType: 'ประเภทวิดเจ็ต', buttonCustomization: 'ปรับแต่งปุ่ม', buttonText: 'ข้อความบนปุ่ม', position: 'ตำแหน่ง',
    bottomRight: 'ล่างขวา', bottomLeft: 'ล่างซ้าย', topRight: 'บนขวา', topLeft: 'บนซ้าย',
    buttonColor: 'สีปุ่ม', textColor: 'สีข้อความ', preview: 'ตัวอย่าง',
    sizeConfig: 'ขนาด', width: 'ความกว้าง', widthHint: 'เช่น 100%, 600px, 80vw', height: 'ความสูง', heightHint: 'เช่น 700px, 80vh',
    embedCode: 'โค้ดสำหรับฝัง', copied: 'คัดลอกแล้ว', copyCode: 'คัดลอกโค้ด', directLink: 'ลิงก์จองโดยตรง', directLinkHint: 'แชร์ลิงก์นี้ให้ลูกค้าได้โดยตรง:',
    copyLink: 'คัดลอกลิงก์', openLink: 'เปิดหน้าจอง',
    howTo: 'วิธีใช้', step1: 'เลือกประเภทวิดเจ็ตที่ต้องการด้านบน', step2: 'ปรับการแสดงผลตามต้องการ',
    step3: 'คัดลอกโค้ดด้วยปุ่ม "คัดลอกโค้ด"', step4: 'วางโค้ดใน HTML ของเว็บไซต์ตรงตำแหน่งที่ต้องการให้วิดเจ็ตแสดง',
    step5Before: 'สำหรับปุ่มลอย ให้วางโค้ดก่อนแท็กปิด', step5After: '',
  },
};

type WidgetType = 'full-page' | 'floating-button' | 'inline';
type ButtonPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

interface WidgetConfig {
  type: WidgetType;
  buttonText: string;
  buttonPosition: ButtonPosition;
  buttonColor: string;
  buttonTextColor: string;
  width: string;
  height: string;
}

export default function WidgetEmbed() {
  const { businessId } = useTenant();
  const premiumFeatures = usePremiumFeatures();
  const { t } = useAdminText(TEXT);
  const [copied, setCopied] = useState<string | null>(null);
  const [bookingUrl, setBookingUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<WidgetConfig>({
    type: 'floating-button',
    buttonText: 'Book Now',
    buttonPosition: 'bottom-right',
    buttonColor: '#1A1714',
    buttonTextColor: '#ffffff',
    width: '100%',
    height: '700px',
  });

  useEffect(() => {
    fetchBusinessDomain();
  }, [businessId]);

  const fetchBusinessDomain = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('permalink, custom_domain')
        .eq('id', businessId)
        .single();

      if (!error && data && data.permalink) {
        // Each shop lives on its own host: <permalink>.<shop base domain>.
        setBookingUrl(shopUrl(data.permalink));
      }
    } catch (err) {
      console.error('Error fetching business domain:', err);
    } finally {
      setLoading(false);
    }
  };

  const getBookingUrl = () => {
    return bookingUrl || '';
  };

  const generateFullPageEmbed = () => {
    return `<!-- ${BRAND_NAME} Booking Widget - Full Page -->
<iframe 
  src="${getBookingUrl()}"
  style="width: ${config.width}; height: ${config.height}; border: none; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);"
  title="Book an Appointment"
  loading="lazy"
></iframe>`;
  };

  const generateInlineEmbed = () => {
    return `<!-- ${BRAND_NAME} Booking Widget - Inline -->
<div id="zenno-booking-widget" style="width: 100%; max-width: 600px; margin: 0 auto;">
  <iframe 
    src="${getBookingUrl()}"
    style="width: 100%; height: ${config.height}; border: none; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);"
    title="Book an Appointment"
    loading="lazy"
  ></iframe>
</div>`;
  };

  const generateFloatingButtonEmbed = () => {
    const positionStyles = {
      'bottom-right': 'bottom: 24px; right: 24px;',
      'bottom-left': 'bottom: 24px; left: 24px;',
      'top-right': 'top: 24px; right: 24px;',
      'top-left': 'top: 24px; left: 24px;',
    };

    return `<!-- ${BRAND_NAME} Booking Widget - Floating Button -->
<style>
  #zenno-floating-btn {
    position: fixed;
    ${positionStyles[config.buttonPosition]}
    z-index: 9999;
    background: ${config.buttonColor};
    color: ${config.buttonTextColor};
    border: none;
    padding: 14px 28px;
    border-radius: 50px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0,0,0,0.25);
    transition: all 0.3s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  #zenno-floating-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0,0,0,0.3);
  }
  #zenno-modal-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 10000;
    backdrop-filter: blur(4px);
  }
  #zenno-modal-content {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 500px;
    height: 85vh;
    max-height: 700px;
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
  }
  #zenno-modal-close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 36px;
    height: 36px;
    background: rgba(0,0,0,0.1);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    transition: background 0.2s;
  }
  #zenno-modal-close:hover {
    background: rgba(0,0,0,0.2);
  }
  #zenno-modal-iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
</style>

<button id="zenno-floating-btn">${config.buttonText}</button>

<div id="zenno-modal-overlay">
  <div id="zenno-modal-content">
    <button id="zenno-modal-close">×</button>
    <iframe id="zenno-modal-iframe" src="" title="Book an Appointment" loading="lazy"></iframe>
  </div>
</div>

<script>
(function() {
  const btn = document.getElementById('zenno-floating-btn');
  const overlay = document.getElementById('zenno-modal-overlay');
  const closeBtn = document.getElementById('zenno-modal-close');
  const iframe = document.getElementById('zenno-modal-iframe');
  const bookingUrl = '${getBookingUrl()}';

  btn.addEventListener('click', function() {
    iframe.src = bookingUrl;
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
  });

  closeBtn.addEventListener('click', function() {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  });

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      overlay.style.display = 'none';
      document.body.style.overflow = '';
    }
  });
})();
</script>`;
  };

  const getEmbedCode = () => {
    switch (config.type) {
      case 'full-page':
        return generateFullPageEmbed();
      case 'inline':
        return generateInlineEmbed();
      case 'floating-button':
        return generateFloatingButtonEmbed();
      default:
        return '';
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const widgetTypes = [
    {
      id: 'floating-button' as WidgetType,
      name: t.floatingName,
      description: t.floatingDesc,
      icon: MessageSquare,
    },
    {
      id: 'full-page' as WidgetType,
      name: t.fullPageName,
      description: t.fullPageDesc,
      icon: Monitor,
    },
    {
      id: 'inline' as WidgetType,
      name: t.inlineName,
      description: t.inlineDesc,
      icon: Layout,
    },
  ];

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-stone-500">{t.loading}</div>
      </div>
    );
  }

  // Premium feature gate
  if (!premiumFeatures.isPro) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="text-xl font-semibold text-stone-800 mb-2">{t.premiumTitle}</h3>
          <p className="text-stone-600 mb-6 max-w-md mx-auto">
            {t.premiumBody}
          </p>
          <div className="flex items-center justify-center gap-2 text-amber-700 font-medium">
            <Crown className="w-5 h-5" />
            <span>{t.proPlan}</span>
          </div>
        </div>

        {/* Preview of what they'll get */}
        <div className="opacity-50 pointer-events-none">
          <div className="border border-stone-200 rounded-xl p-6">
            <h4 className="font-medium text-stone-800 mb-4">{t.typesWithPro}</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {widgetTypes.map((type) => (
                <div key={type.id} className="p-4 border border-stone-200 rounded-lg">
                  <type.icon className="w-6 h-6 text-stone-400 mb-2" />
                  <h5 className="font-medium text-stone-700">{type.name}</h5>
                  <p className="text-xs text-stone-500 mt-1">{type.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if booking URL is set
  if (!bookingUrl) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">{t.notFoundTitle}</h3>
          <p className="text-sm text-yellow-700 mb-4">
            {t.notFoundBefore}<strong>{t.profileName}</strong>{t.notFoundAfter}
          </p>
          <p className="text-sm text-yellow-600">
            {t.notFoundRefresh}
          </p>
        </div>
        
        {/* Manual URL input as fallback */}
        <div className="border border-stone-200 rounded-xl p-6">
          <h4 className="font-medium text-stone-800 mb-3">{t.manualTitle}</h4>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder={shopUrl('your-business')}
              value={bookingUrl}
              onChange={(e) => setBookingUrl(e.target.value)}
              className="flex-1 px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-800"
            />
          </div>
          <p className="text-xs text-stone-500 mt-2">
            {fillText(t.manualHint, { example: shopUrl('my-business') })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-lg font-semibold text-stone-800">{t.heading}</h3>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full flex items-center gap-1">
            <Crown className="w-3 h-3" />
            Pro
          </span>
        </div>
        <p className="text-sm text-stone-600">
          {t.intro}
        </p>
      </div>

      {/* Widget Type Selection */}
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-3">{t.widgetType}</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {widgetTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setConfig({ ...config, type: type.id })}
              className={`p-4 border-2 rounded-xl text-left transition-all ${
                config.type === type.id
                  ? 'border-stone-800 bg-stone-50'
                  : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              <type.icon className={`w-6 h-6 mb-2 ${config.type === type.id ? 'text-stone-800' : 'text-stone-400'}`} />
              <h4 className="font-medium text-stone-800">{type.name}</h4>
              <p className="text-xs text-stone-500 mt-1">{type.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Configuration Options */}
      {config.type === 'floating-button' && (
        <div className="space-y-4 p-4 bg-stone-50 rounded-xl border border-stone-200">
          <h4 className="font-medium text-stone-800 flex items-center gap-2">
            <Palette className="w-4 h-4" />
            {t.buttonCustomization}
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">{t.buttonText}</label>
              <input
                type="text"
                value={config.buttonText}
                onChange={(e) => setConfig({ ...config, buttonText: e.target.value })}
                className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-800"
                placeholder="Book Now"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">{t.position}</label>
              <select
                value={config.buttonPosition}
                onChange={(e) => setConfig({ ...config, buttonPosition: e.target.value as ButtonPosition })}
                className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-800"
              >
                <option value="bottom-right">{t.bottomRight}</option>
                <option value="bottom-left">{t.bottomLeft}</option>
                <option value="top-right">{t.topRight}</option>
                <option value="top-left">{t.topLeft}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">{t.buttonColor}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.buttonColor}
                  onChange={(e) => setConfig({ ...config, buttonColor: e.target.value })}
                  className="w-12 h-10 rounded cursor-pointer border border-stone-200"
                />
                <input
                  type="text"
                  value={config.buttonColor}
                  onChange={(e) => setConfig({ ...config, buttonColor: e.target.value })}
                  className="flex-1 px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-800 font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">{t.textColor}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.buttonTextColor}
                  onChange={(e) => setConfig({ ...config, buttonTextColor: e.target.value })}
                  className="w-12 h-10 rounded cursor-pointer border border-stone-200"
                />
                <input
                  type="text"
                  value={config.buttonTextColor}
                  onChange={(e) => setConfig({ ...config, buttonTextColor: e.target.value })}
                  className="flex-1 px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-800 font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* Button Preview */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-stone-700 mb-2">{t.preview}</label>
            <div className="bg-white border border-stone-200 rounded-lg p-8 flex items-center justify-center min-h-[100px] relative">
              <button
                style={{
                  background: config.buttonColor,
                  color: config.buttonTextColor,
                  padding: '14px 28px',
                  borderRadius: '50px',
                  fontSize: '16px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                }}
              >
                {config.buttonText}
              </button>
            </div>
          </div>
        </div>
      )}

      {(config.type === 'full-page' || config.type === 'inline') && (
        <div className="space-y-4 p-4 bg-stone-50 rounded-xl border border-stone-200">
          <h4 className="font-medium text-stone-800 flex items-center gap-2">
            <Layout className="w-4 h-4" />
            {t.sizeConfig}
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">{t.width}</label>
              <input
                type="text"
                value={config.width}
                onChange={(e) => setConfig({ ...config, width: e.target.value })}
                className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-800"
                placeholder="100%"
              />
              <p className="text-xs text-stone-500 mt-1">{t.widthHint}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">{t.height}</label>
              <input
                type="text"
                value={config.height}
                onChange={(e) => setConfig({ ...config, height: e.target.value })}
                className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-800"
                placeholder="700px"
              />
              <p className="text-xs text-stone-500 mt-1">{t.heightHint}</p>
            </div>
          </div>
        </div>
      )}

      {/* Embed Code */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-stone-700 flex items-center gap-2">
            <Code className="w-4 h-4" />
            {t.embedCode}
          </label>
          <button
            onClick={() => copyToClipboard(getEmbedCode(), 'embed')}
            className="flex items-center gap-2 px-4 py-2 bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors text-sm"
          >
            {copied === 'embed' ? (
              <>
                <Check className="w-4 h-4" />
                {t.copied}
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                {t.copyCode}
              </>
            )}
          </button>
        </div>
        
        <div className="relative">
          <pre className="bg-stone-900 text-stone-100 p-4 rounded-xl overflow-x-auto text-sm font-mono whitespace-pre-wrap">
            {getEmbedCode()}
          </pre>
        </div>
      </div>

      {/* Direct Link */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <h4 className="font-medium text-blue-800 flex items-center gap-2 mb-2">
          <ExternalLink className="w-4 h-4" />
          {t.directLink}
        </h4>
        <p className="text-sm text-blue-700 mb-3">
          {t.directLinkHint}
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={getBookingUrl()}
            readOnly
            className="flex-1 px-4 py-2 bg-white border border-blue-200 rounded-lg text-sm font-mono"
          />
          <button
            onClick={() => copyToClipboard(getBookingUrl(), 'link')}
            aria-label={t.copyLink}
            title={t.copyLink}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2"
          >
            {copied === 'link' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <a
            href={getBookingUrl()}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.openLink}
            title={t.openLink}
            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Instructions */}
      <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl">
        <h4 className="font-medium text-stone-800 mb-3">{t.howTo}</h4>
        <ol className="text-sm text-stone-600 space-y-2 list-decimal list-inside">
          <li>{t.step1}</li>
          <li>{t.step2}</li>
          <li>{t.step3}</li>
          <li>{t.step4}</li>
          <li>{t.step5Before} <code className="bg-stone-200 px-1 rounded">&lt;/body&gt;</code>{t.step5After}</li>
        </ol>
      </div>
    </div>
  );
}
