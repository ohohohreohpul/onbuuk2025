import { useEffect, useState, useSyncExternalStore } from 'react';
import { initialAdminLanguage, type AdminLanguage } from '../lib/adminLanguage';
import { loadMetaPixel, sendOwnerEvent } from '../lib/metaPixel';
import {
  CONSENT_CHANGE_EVENT,
  QUEUE_CHANGE_EVENT,
  readConsent,
  takeQueuedEvents,
  writeConsent,
  type Consent,
} from '../lib/ownerTracking';

const PRIVACY_URL: Record<AdminLanguage, string> = {
  de: 'https://www.zennohq.com/privacy/',
  en: 'https://www.zennohq.com/en/privacy/',
  th: 'https://www.zennohq.com/th/privacy/',
};

const TEXT: Record<AdminLanguage, { title: string; body: string; privacy: string; accept: string; decline: string }> = {
  de: {
    title: 'Cookies für unsere Werbung',
    body: 'Mit Ihrer Zustimmung laden wir das Meta-Pixel, um zu messen, welche Anzeigen zu neuen Zenno-Konten führen. Ohne Zustimmung setzen wir dafür keine Cookies.',
    privacy: 'Datenschutz',
    accept: 'Akzeptieren',
    decline: 'Ablehnen',
  },
  en: {
    title: 'Cookies for our ads',
    body: 'With your consent we load the Meta pixel to measure which ads lead to new Zenno accounts. Without it, we set no cookies for this.',
    privacy: 'Privacy',
    accept: 'Accept',
    decline: 'Decline',
  },
  th: {
    title: 'คุกกี้สำหรับโฆษณาของเรา',
    body: 'หากคุณยินยอม เราจะโหลด Meta Pixel เพื่อวัดว่าโฆษณาใดทำให้มีบัญชี Zenno ใหม่ หากไม่ยินยอม เราจะไม่ตั้งค่าคุกกี้สำหรับเรื่องนี้',
    privacy: 'ความเป็นส่วนตัว',
    accept: 'ยอมรับ',
    decline: 'ปฏิเสธ',
  },
};

const subscribe = (onChange: () => void) => {
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
};

interface OwnerConsentBannerProps {
  pixelId: string;
}

/**
 * Cookie banner + Zenno's Meta pixel on owner pages (mounted only there, see
 * main.tsx). Accept and Decline have equal weight, as German consent rules
 * require. After consent it sends PageView and any queued owner events.
 */
export default function OwnerConsentBanner({ pixelId }: OwnerConsentBannerProps) {
  const consent = useSyncExternalStore(subscribe, () => readConsent(), () => null);
  const [language] = useState(initialAdminLanguage);

  useEffect(() => {
    if (consent !== 'granted') return;
    loadMetaPixel(pixelId);
    const flush = () => takeQueuedEvents().forEach(sendOwnerEvent);
    flush();
    window.addEventListener(QUEUE_CHANGE_EVENT, flush);
    return () => window.removeEventListener(QUEUE_CHANGE_EVENT, flush);
  }, [consent, pixelId]);

  if (consent !== null) return null;

  const t = TEXT[language];
  const choose = (choice: Consent) => writeConsent(choice);
  const button =
    'min-h-[44px] rounded-full bg-[#1A1714] px-5 text-sm font-medium text-white transition hover:bg-[#2E2926] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2';

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="owner-consent-title"
      lang={language}
      className="fixed bottom-4 left-1/2 z-[60] grid w-[min(100%-2rem,46rem)] -translate-x-1/2 gap-4 rounded-2xl border border-[#E4DFD7] bg-[#FDFCFA]/95 p-5 text-[#1A1714] shadow-[0_24px_60px_-24px_rgba(26,23,20,0.35)] backdrop-blur sm:grid-cols-[1fr_auto] sm:items-center"
    >
      <div className="grid gap-1">
        <p id="owner-consent-title" className="text-[15px] font-semibold">{t.title}</p>
        <p className="text-sm leading-relaxed text-[#6B6560]">
          {t.body}{' '}
          <a href={PRIVACY_URL[language]} target="_blank" rel="noreferrer" className="text-[#1A1714] underline underline-offset-2">
            {t.privacy}
          </a>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={button} onClick={() => choose('denied')}>{t.decline}</button>
        <button type="button" className={button} onClick={() => choose('granted')}>{t.accept}</button>
      </div>
    </div>
  );
}
