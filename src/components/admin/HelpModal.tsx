import { useState } from 'react';
import { BookOpen, Check, Copy, Mail } from 'lucide-react';
import { useAdminText } from '../../lib/adminLanguage';
import { BRAND_DOCS_URL, BRAND_SUPPORT_EMAIL } from '../../lib/brand';
import { Translations } from '../../lib/bookingLanguage';
import { ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON } from './adminUi';
import CalendarModal from './calendar/CalendarModal';

const COPIED_RESET_MS = 2000;

type Keys = 'title' | 'subtitle' | 'emailUs' | 'emailHint' | 'write' | 'copy' | 'copied' | 'docs' | 'docsHint' | 'close' | 'subject' | 'bodyIntro' | 'details';

const TEXT: Translations<Record<Keys, string>> = {
  en: {
    title: 'Get help', subtitle: 'A real person from the Zenno team answers.', emailUs: 'Email us', emailHint: 'Tell us what you wanted to do and what happened. A screenshot helps.',
    write: 'Write email', copy: 'Copy', copied: 'Copied', docs: 'Read the guide', docsHint: 'Step-by-step help for the calendar, vouchers, payments and the AI receptionist.', close: 'Close',
    subject: 'Help with Zenno', bodyIntro: 'Hi Zenno team,\n\nWhat I wanted to do:\n\nWhat happened instead:\n\n', details: 'My details (please keep):',
  },
  de: {
    title: 'Hilfe', subtitle: 'Ein Mensch aus dem Zenno-Team antwortet Ihnen.', emailUs: 'Schreiben Sie uns', emailHint: 'Beschreiben Sie, was Sie tun wollten und was passiert ist. Ein Screenshot hilft.',
    write: 'E-Mail schreiben', copy: 'Kopieren', copied: 'Kopiert', docs: 'Anleitung lesen', docsHint: 'Schritt für Schritt: Kalender, Gutscheine, Zahlungen und die KI-Rezeption.', close: 'Schließen',
    subject: 'Hilfe zu Zenno', bodyIntro: 'Hallo Zenno-Team,\n\nDas wollte ich tun:\n\nDas ist stattdessen passiert:\n\n', details: 'Meine Angaben (bitte stehen lassen):',
  },
  th: {
    title: 'ขอความช่วยเหลือ', subtitle: 'ทีมงาน Zenno จะตอบกลับคุณเอง', emailUs: 'ส่งอีเมลหาเรา', emailHint: 'บอกเราว่าคุณต้องการทำอะไรและเกิดอะไรขึ้น ภาพหน้าจอจะช่วยได้มาก',
    write: 'เขียนอีเมล', copy: 'คัดลอก', copied: 'คัดลอกแล้ว', docs: 'อ่านคู่มือ', docsHint: 'วิธีใช้ปฏิทิน บัตรของขวัญ การชำระเงิน และพนักงานต้อนรับ AI ทีละขั้นตอน', close: 'ปิด',
    subject: 'ขอความช่วยเหลือ Zenno', bodyIntro: 'สวัสดีทีม Zenno\n\nสิ่งที่ต้องการทำ:\n\nสิ่งที่เกิดขึ้น:\n\n', details: 'ข้อมูลของฉัน (กรุณาเก็บไว้):',
  },
};

interface HelpModalProps {
  account: { name: string; email: string; businessId: string | null };
  currentView: string;
  onClose: () => void;
}

/** Get help: support email (prefilled with the account details) and the guide. */
export default function HelpModal({ account, currentView, onClose }: HelpModalProps) {
  const { t } = useAdminText(TEXT);
  const [isCopied, setIsCopied] = useState(false);

  const details = [
    `${t.details}`,
    `${account.name} <${account.email}>`,
    account.businessId ? `Shop: ${account.businessId}` : null,
    `Page: ${currentView}`,
    `Browser: ${navigator.userAgent}`,
  ].filter(Boolean).join('\n');
  const mailto = `mailto:${BRAND_SUPPORT_EMAIL}?subject=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(`${t.bodyIntro}${details}`)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(BRAND_SUPPORT_EMAIL);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), COPIED_RESET_MS);
    } catch (error) {
      console.error('Could not copy the support address:', error);
    }
  };

  return (
    <CalendarModal title={t.title} subtitle={t.subtitle} closeLabel={t.close} onClose={onClose}>
      <div className="space-y-3">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-900/[0.06]">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[#1A1714]"><Mail className="h-4 w-4" />{t.emailUs}</h3>
          <p className="mt-1 text-sm text-stone-500">{t.emailHint}</p>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-stone-900/[0.04] px-3 py-2">
            <span className="flex-1 select-all truncate text-sm font-medium text-[#1A1714]">{BRAND_SUPPORT_EMAIL}</span>
            <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-stone-600 hover:bg-white hover:text-[#1A1714]">
              {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}{isCopied ? t.copied : t.copy}
            </button>
          </div>
          <a href={mailto} className={`${ADMIN_PRIMARY_BUTTON} mt-3 w-full`}><Mail className="h-4 w-4" />{t.write}</a>
        </section>
        <a href={BRAND_DOCS_URL} target="_blank" rel="noopener noreferrer"
          className="flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-stone-900/[0.06] transition hover:-translate-y-0.5 hover:shadow-[0_10px_32px_rgba(26,23,20,0.085)]">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[#1A1714]" />
          <span>
            <span className="block text-sm font-semibold text-[#1A1714]">{t.docs}</span>
            <span className="block text-sm text-stone-500">{t.docsHint}</span>
          </span>
        </a>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={ADMIN_SECONDARY_BUTTON}>{t.close}</button>
        </div>
      </div>
    </CalendarModal>
  );
}
