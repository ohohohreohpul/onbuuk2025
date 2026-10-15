import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { adminAuth } from '../../../lib/adminAuth';
import { RELAUNCH_ANNOUNCEMENT_KEY, RELAUNCH_SLIDES, type AnnouncementSlide } from './relaunchSlides';
import { useAdminText, type AdminLanguage } from '../../../lib/adminLanguage';
import { fillText, type Translations } from '../../../lib/bookingLanguage';

const TEXT: Translations<{
  close: string; back: string; skip: string; seeWhatsNew: string; getStarted: string; next: string;
  slideOf: string; goTo: string;
}> = {
  en: {
    close: 'Close', back: 'Back', skip: 'Skip', seeWhatsNew: "See what's new", getStarted: 'Get started', next: 'Next',
    slideOf: 'Slide {current} of {total}', goTo: 'Go to {title}',
  },
  de: {
    close: 'Schließen', back: 'Zurück', skip: 'Überspringen', seeWhatsNew: 'Neuigkeiten ansehen', getStarted: 'Los geht’s', next: 'Weiter',
    slideOf: 'Folie {current} von {total}', goTo: 'Zu „{title}“',
  },
  th: {
    close: 'ปิด', back: 'ย้อนกลับ', skip: 'ข้าม', seeWhatsNew: 'ดูสิ่งใหม่', getStarted: 'เริ่มใช้งาน', next: 'ถัดไป',
    slideOf: 'สไลด์ {current} จาก {total}', goTo: 'ไปที่ {title}',
  },
};

type SlideCopy = Pick<AnnouncementSlide, 'eyebrow' | 'title' | 'body' | 'points'>;

/** Translated slide copy by slide id; English comes from relaunchSlides itself. */
const SLIDE_TEXT: Record<Exclude<AdminLanguage, 'en'>, Record<string, SlideCopy>> = {
  de: {
    welcome: {
      eyebrow: 'Ein neues Kapitel',
      title: 'Buuk ist jetzt Teil von ZennoHQ',
      body: 'Gleiches Produkt, gleiches Team hinter Ihren Buchungen – jetzt mit mehr Leuten, die daran arbeiten. Leistungen, Kund:innen, Buchungen, Gutscheine und Einstellungen sind genau dort, wo Sie sie gelassen haben. Nichts muss neu eingerichtet werden.',
      points: ['Ihre Daten und Links bleiben gleich', 'Ihre Kund:innen merken keine Unterbrechung', 'Das haben wir für Sie gebaut'],
    },
    'action-centre': {
      eyebrow: 'Neu · 1 von 6',
      title: 'Aktionszentrale',
      body: 'Ihre tägliche To-do-Liste, erstellt aus Ihren eigenen Buchungen. Sie zeigt, was Aufmerksamkeit braucht, welches Geld Sie noch zurückholen können – und den einen Button, der es erledigt.',
      points: ['Abgesagte Termine neu füllen', 'Offene Gebühren einziehen', 'Stammkund:innen zurückgewinnen, die nicht wiederkamen'],
    },
    'no-shows': {
      eyebrow: 'Neu · 2 von 6',
      title: 'No-Show-Verwaltung',
      body: 'No-Shows mit einem Klick markieren und die Gebühr nach Ihren Vorstellungen abwickeln. Alle No-Shows stehen in einer Liste, damit nichts verloren geht.',
      points: ['Bei der Buchung hinterlegte Karte belasten', 'Bar oder per Überweisung erfassen oder erlassen', 'Wiederholte No-Shows auf einen Blick erkennen'],
    },
    'gift-cards': {
      eyebrow: 'Neu · 3 von 6',
      title: 'Gutscheine schneller finden',
      body: 'Legen Sie fest, wie Ihre Gutscheincodes aussehen, und finden Sie jeden Gutschein an der Theke in Sekunden.',
      points: ['Code-Format wählen, z. B. 6 Ziffern oder SPA-483921', 'Gutschein per Eingabe oder Scan des Codes finden', 'Vor Ort einlösen mit aktuellem Guthaben'],
    },
    tax: {
      eyebrow: 'Neu · 4 von 6',
      title: 'Steuer- und Rechnungsverwaltung',
      body: 'Einnahmen und Unterlagen an einem Ort – bereit, wenn Ihre Steuerberatung danach fragt.',
      points: ['Bareinnahmen Tag für Tag erfassen', 'Umsätze aus anderen Tools importieren', 'Steuerunterlagen direkt bei den Berichten ablegen'],
    },
    security: {
      eyebrow: 'Neu · 5 von 6',
      title: 'Mehr Sicherheit',
      body: 'Wir haben verschärft, wer was sehen und ändern darf – damit Ihr Betrieb und Ihre Kund:innen geschützt bleiben.',
      points: ['Jeder Betrieb ist vollständig getrennt', 'Team-Berechtigungen werden auf unseren Servern durchgesetzt', 'Tarif- und Abrechnungseinstellungen sind abgesichert'],
    },
    dashboard: {
      eyebrow: 'Neu · 6 von 6',
      title: 'Ein intelligenteres Dashboard',
      body: 'Zahlen, auf die Sie sich verlassen können. Besuche, Umsatz und No-Shows werden live aus Ihren Buchungen berechnet – jede Ansicht zeigt dasselbe Bild.',
      points: ['Genaue Besuche und Umsätze pro Kund:in', 'Klare nächste Schritte bei jeder Buchung', 'Alles Wichtige für heute an einem Ort'],
    },
  },
  th: {
    welcome: {
      eyebrow: 'บทใหม่ของเรา',
      title: 'Buuk เป็นส่วนหนึ่งของ ZennoHQ แล้ว',
      body: 'ผลิตภัณฑ์เดิม ทีมเดิมที่ดูแลการจองของคุณ แต่มีคนช่วยพัฒนามากขึ้น บริการ ลูกค้า การจอง บัตรของขวัญ และการตั้งค่าทั้งหมดยังอยู่ที่เดิม ไม่ต้องตั้งค่าใหม่',
      points: ['ข้อมูลและลิงก์ของคุณยังเหมือนเดิม', 'ลูกค้าใช้งานได้ต่อเนื่องไม่สะดุด', 'นี่คือสิ่งที่เราสร้างมาเพื่อคุณ'],
    },
    'action-centre': {
      eyebrow: 'มีอะไรใหม่ · 1 จาก 6',
      title: 'ศูนย์งานที่ต้องทำ',
      body: 'รายการสิ่งที่ต้องทำประจำวัน สร้างจากการจองของคุณเอง บอกว่าอะไรต้องจัดการ เงินส่วนไหนยังเรียกคืนได้ และปุ่มเดียวที่แก้ได้ทันที',
      points: ['เติมคิวที่ถูกยกเลิก', 'เก็บค่าธรรมเนียมที่ยังไม่ได้ชำระ', 'ดึงลูกค้าประจำที่หายไปให้กลับมา'],
    },
    'no-shows': {
      eyebrow: 'มีอะไรใหม่ · 2 จาก 6',
      title: 'จัดการลูกค้าไม่มาตามนัด',
      body: 'บันทึกลูกค้าไม่มาตามนัดได้ในคลิกเดียว และจัดการค่าธรรมเนียมตามที่คุณต้องการ ทุกรายการรวมอยู่ในที่เดียว ไม่มีตกหล่น',
      points: ['เรียกเก็บจากบัตรที่บันทึกไว้ตอนจอง', 'บันทึกเงินสด โอนเงิน หรือยกเว้นค่าธรรมเนียม', 'เห็นลูกค้าที่ไม่มาซ้ำได้ทันที'],
    },
    'gift-cards': {
      eyebrow: 'มีอะไรใหม่ · 3 จาก 6',
      title: 'ค้นหาบัตรของขวัญได้ง่ายขึ้น',
      body: 'เลือกรูปแบบรหัสบัตรของขวัญได้เอง และค้นหาบัตรใดก็ได้ที่เคาน์เตอร์ในไม่กี่วินาที',
      points: ['เลือกรูปแบบรหัส เช่น ตัวเลข 6 หลัก หรือ SPA-483921', 'ค้นหาบัตรด้วยการพิมพ์หรือสแกนรหัส', 'ใช้บัตรที่ร้านพร้อมดูยอดคงเหลือทันที'],
    },
    tax: {
      eyebrow: 'มีอะไรใหม่ · 4 จาก 6',
      title: 'จัดการภาษีและใบแจ้งหนี้',
      body: 'เก็บรายรับและเอกสารไว้ในที่เดียว พร้อมเมื่อนักบัญชีขอ',
      points: ['บันทึกรายรับเงินสดรายวัน', 'นำเข้ารายได้จากเครื่องมืออื่น', 'เก็บเอกสารภาษีไว้คู่กับรายงาน'],
    },
    security: {
      eyebrow: 'มีอะไรใหม่ · 5 จาก 6',
      title: 'ความปลอดภัยที่แข็งแรงขึ้น',
      body: 'เราเข้มงวดขึ้นว่าใครดูและแก้ไขอะไรได้บ้าง เพื่อปกป้องธุรกิจและลูกค้าของคุณ',
      points: ['แต่ละธุรกิจแยกจากกันอย่างสมบูรณ์', 'สิทธิ์ของทีมถูกบังคับใช้บนเซิร์ฟเวอร์ของเรา', 'การตั้งค่าแพ็กเกจและการเรียกเก็บเงินถูกล็อกไว้'],
    },
    dashboard: {
      eyebrow: 'มีอะไรใหม่ · 6 จาก 6',
      title: 'แดชบอร์ดที่ฉลาดขึ้น',
      body: 'ตัวเลขที่เชื่อถือได้ จำนวนครั้งที่มา ยอดใช้จ่าย และการไม่มาตามนัดคำนวณสดจากการจองของคุณ ทุกหน้าจอจึงแสดงข้อมูลตรงกัน',
      points: ['จำนวนครั้งและยอดใช้จ่ายต่อลูกค้าที่แม่นยำ', 'ขั้นตอนถัดไปที่ชัดเจนในทุกการจอง', 'ดูสิ่งสำคัญของวันนี้ได้ในที่เดียว'],
    },
  },
};

const localizeSlide = (slide: AnnouncementSlide, lang: AdminLanguage): AnnouncementSlide => {
  if (lang === 'en') return slide;
  const copy = SLIDE_TEXT[lang][slide.id];
  return copy ? { ...slide, ...copy } : slide;
};

/**
 * One-time "Buuk is now part of ZennoHQ" + what's new walkthrough.
 * Shown once per admin account; the view is recorded in admin_announcement_views.
 */
export default function WhatsNewModal() {
  const { t, lang } = useAdminText(TEXT);
  const adminUserId = adminAuth.getCurrentUser()?.id ?? null;
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const slide = localizeSlide(RELAUNCH_SLIDES[index], lang);
  const isLast = index === RELAUNCH_SLIDES.length - 1;

  useEffect(() => {
    if (!adminUserId) return;
    let isCancelled = false;

    supabase
      .from('admin_announcement_views')
      .select('announcement_key')
      .eq('admin_user_id', adminUserId)
      .eq('announcement_key', RELAUNCH_ANNOUNCEMENT_KEY)
      .maybeSingle()
      .then(({ data, error }) => {
        // If we cannot tell, stay quiet rather than risk showing it on every login.
        if (error) {
          console.error('Could not check announcement status:', error);
          return;
        }
        if (!isCancelled && !data) setIsOpen(true);
      });

    return () => {
      isCancelled = true;
    };
  }, [adminUserId]);

  const close = useCallback(async () => {
    setIsOpen(false);
    if (!adminUserId) return;
    const { error } = await supabase
      .from('admin_announcement_views')
      .upsert(
        { admin_user_id: adminUserId, announcement_key: RELAUNCH_ANNOUNCEMENT_KEY },
        { onConflict: 'admin_user_id,announcement_key', ignoreDuplicates: true }
      );
    if (error) console.error('Could not record announcement view:', error);
  }, [adminUserId]);

  const next = useCallback(() => {
    if (isLast) close();
    else setIndex((current) => current + 1);
  }, [isLast, close]);

  const back = useCallback(() => setIndex((current) => Math.max(0, current - 1)), []);

  useEffect(() => {
    if (!isOpen) return;
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') next();
      if (event.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close, next, back]);

  if (!isOpen) return null;

  const Icon = slide.icon;
  const isWelcome = index === 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1A1714]/50 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        tabIndex={-1}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-[#F7F5F2] shadow-[0_24px_80px_rgba(26,23,20,0.35)] outline-none"
      >
        <button
          type="button"
          onClick={close}
          aria-label={t.close}
          className={`absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
            isWelcome ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-stone-400 hover:bg-stone-900/5 hover:text-stone-700'
          }`}
        >
          <X className="h-4 w-4" />
        </button>

        <div className={`relative px-8 pb-8 pt-10 ${isWelcome ? 'bg-[#1A1714] text-white' : ''}`}>
          {isWelcome && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(160,153,144,0.35),transparent_70%)]"
            />
          )}
          <div
            className={`mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${
              isWelcome ? 'bg-white/10 text-white' : 'bg-[#1A1714] text-white'
            }`}
          >
            <Icon className="h-6 w-6" strokeWidth={1.6} />
          </div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${isWelcome ? 'text-white/55' : 'text-stone-400'}`}>
            {slide.eyebrow}
          </p>
          <h2 id="whats-new-title" className={`mt-2 text-[26px] font-semibold leading-tight tracking-tight ${isWelcome ? 'text-white' : 'text-[#1A1714]'}`}>
            {slide.title}
          </h2>
          <p className={`mt-3 text-[15px] leading-relaxed ${isWelcome ? 'text-white/75' : 'text-stone-600'}`}>{slide.body}</p>
        </div>

        {slide.points && (
          <ul className="space-y-2.5 px-8 pt-6">
            {slide.points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-stone-700">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70">
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
                {point}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-4 px-8 pb-7 pt-8">
          <div className="flex items-center gap-1.5" aria-label={fillText(t.slideOf, { current: index + 1, total: RELAUNCH_SLIDES.length })}>
            {RELAUNCH_SLIDES.map((item, dotIndex) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(dotIndex)}
                aria-label={fillText(t.goTo, { title: localizeSlide(item, lang).title })}
                className={`h-1.5 rounded-full transition-all duration-300 ${dotIndex === index ? 'w-6 bg-[#1A1714]' : 'w-1.5 bg-stone-300 hover:bg-stone-400'}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {index > 0 ? (
              <button
                type="button"
                onClick={back}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-900/5 hover:text-[#1A1714]"
              >
                <ArrowLeft className="h-4 w-4" /> {t.back}
              </button>
            ) : (
              <button
                type="button"
                onClick={close}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-stone-500 transition hover:bg-stone-900/5 hover:text-stone-700"
              >
                {t.skip}
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1A1714] px-4 py-2.5 text-sm font-medium text-white shadow-[0_2px_12px_rgba(26,23,20,0.18)] transition hover:bg-[#2E2926] active:translate-y-px"
            >
              {isWelcome ? t.seeWhatsNew : isLast ? t.getStarted : t.next}
              {!isLast && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
