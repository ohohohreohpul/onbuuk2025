import type { Translations } from '../../../lib/bookingLanguage';

type Keys =
  | 'freePlan' | 'zennoPlan' | 'customPlan' | 'upgrade' | 'onFree' | 'onZenno' | 'onCustom'
  | 'title' | 'subtitle' | 'current' | 'perMonth' | 'vatIncluded' | 'choose' | 'starting' | 'contact' | 'manage'
  | 'freeLine' | 'zennoLine' | 'customLine' | 'coupon' | 'couponPlaceholder'
  | 'fFreeTherapist' | 'fFreeServices' | 'fFreeBooking' | 'fFreeBadge'
  | 'fAllTherapists' | 'fAi' | 'fAiReplies' | 'fVouchers' | 'fDomain' | 'fNoBadge' | 'fSupport'
  | 'fCustomAll' | 'fCustomLocations' | 'fCustomReplies' | 'fCustomSetup'
  | 'upgradeSuccess' | 'upgradeCancelled' | 'paymentIssue' | 'failed'
  | 'aiTitle' | 'aiHint' | 'aiUsed' | 'aiExtra' | 'aiLeft' | 'aiEmpty' | 'aiFree' | 'buy' | 'buying' | 'replies'
  | 'packHint' | 'creditsSuccess' | 'creditsCancelled';

export const BILLING_TEXT: Translations<Record<Keys, string>> = {
  en: {
    freePlan: 'Free', zennoPlan: 'Zenno', customPlan: 'Custom', upgrade: 'Upgrade',
    onFree: 'Free plan', onZenno: 'Zenno plan', onCustom: 'Custom plan',
    title: 'Your plan', subtitle: 'One plan with everything. For several locations or special needs we make you an offer.',
    current: 'Your plan', perMonth: '/ month', vatIncluded: 'incl. VAT', choose: 'Upgrade to Zenno', starting: 'Opening checkout…',
    contact: 'Write to us', manage: 'Invoices & payment method',
    freeLine: 'To get started.', zennoLine: 'Booking software that books itself.', customLine: 'Tailored to your business.',
    coupon: 'Coupon code (optional)', couponPlaceholder: 'Enter a code',
    fFreeTherapist: '1 therapist', fFreeServices: '5 treatments', fFreeBooking: 'Booking page, POS calendar, vouchers and payments', fFreeBadge: '"Powered by Zenno" on your booking page',
    fAllTherapists: 'Unlimited therapists and treatments', fAi: 'AI receptionist on WhatsApp, email and your website',
    fAiReplies: '1,000 AI replies every month', fVouchers: 'Vouchers, payments, no-show fees, cash book',
    fDomain: 'Your own domain', fNoBadge: 'No "Powered by Zenno"', fSupport: 'Help from a person',
    fCustomAll: 'Everything in Zenno', fCustomLocations: 'Several locations or teams', fCustomReplies: 'AI replies to fit your volume', fCustomSetup: 'Set-up and import done for you',
    upgradeSuccess: 'Thank you! Your shop is on the Zenno plan.', upgradeCancelled: 'Checkout was cancelled. Nothing was charged.',
    paymentIssue: 'Your last payment did not go through. Please update your payment method.', failed: 'Something went wrong. Please try again.',
    aiTitle: 'AI replies', aiHint: 'Each answer from your AI receptionist uses one reply. Your plan includes a monthly amount; extra replies never expire.',
    aiUsed: '{used} of {allowance} used this month', aiExtra: '+ {count} extra replies', aiLeft: '{count} replies left',
    aiEmpty: 'No replies left. The AI pauses and new messages wait for your team in the inbox.',
    aiFree: 'The AI receptionist is part of the Zenno plan.', buy: 'Buy', buying: 'Opening…', replies: '{count} replies',
    packHint: 'One-time payment. Used after your monthly replies.',
    creditsSuccess: 'Thank you! Your replies are added in a moment.', creditsCancelled: 'Purchase cancelled. Nothing was charged.',
  },
  de: {
    freePlan: 'Free', zennoPlan: 'Zenno', customPlan: 'Individuell', upgrade: 'Upgrade',
    onFree: 'Free-Tarif', onZenno: 'Zenno-Tarif', onCustom: 'Individueller Tarif',
    title: 'Ihr Tarif', subtitle: 'Ein Tarif mit allem. Für mehrere Standorte oder besondere Wünsche machen wir Ihnen ein Angebot.',
    current: 'Ihr Tarif', perMonth: '/ Monat', vatIncluded: 'inkl. MwSt.', choose: 'Auf Zenno upgraden', starting: 'Kasse wird geöffnet…',
    contact: 'Schreiben Sie uns', manage: 'Rechnungen & Zahlungsart',
    freeLine: 'Zum Start.', zennoLine: 'Buchungssoftware, die für Sie bucht.', customLine: 'Passend für Ihr Geschäft.',
    coupon: 'Gutscheincode (optional)', couponPlaceholder: 'Code eingeben',
    fFreeTherapist: '1 Therapeut:in', fFreeServices: '5 Behandlungen', fFreeBooking: 'Buchungsseite, POS-Kalender, Gutscheine und Zahlungen', fFreeBadge: '„Powered by Zenno“ auf Ihrer Buchungsseite',
    fAllTherapists: 'Unbegrenzt Therapeut:innen und Behandlungen', fAi: 'KI-Rezeption auf WhatsApp, per E-Mail und auf Ihrer Website',
    fAiReplies: '1.000 KI-Antworten jeden Monat', fVouchers: 'Gutscheine, Zahlungen, No-Show-Gebühren, Kassenbuch',
    fDomain: 'Eigene Domain', fNoBadge: 'Ohne „Powered by Zenno“', fSupport: 'Hilfe von einem Menschen',
    fCustomAll: 'Alles aus Zenno', fCustomLocations: 'Mehrere Standorte oder Teams', fCustomReplies: 'KI-Antworten passend zu Ihrem Bedarf', fCustomSetup: 'Einrichtung und Import übernehmen wir',
    upgradeSuccess: 'Danke! Ihr Laden ist jetzt im Zenno-Tarif.', upgradeCancelled: 'Bezahlung abgebrochen. Es wurde nichts berechnet.',
    paymentIssue: 'Ihre letzte Zahlung ist nicht durchgegangen. Bitte aktualisieren Sie Ihre Zahlungsart.', failed: 'Etwas ist schiefgelaufen. Bitte erneut versuchen.',
    aiTitle: 'KI-Antworten', aiHint: 'Jede Antwort Ihrer KI-Rezeption verbraucht eine Antwort. Ihr Tarif enthält ein Monatskontingent; zusätzliche Antworten verfallen nicht.',
    aiUsed: '{used} von {allowance} diesen Monat genutzt', aiExtra: '+ {count} zusätzliche Antworten', aiLeft: 'Noch {count} Antworten',
    aiEmpty: 'Keine Antworten mehr. Die KI pausiert, neue Nachrichten warten im Posteingang auf Ihr Team.',
    aiFree: 'Die KI-Rezeption ist Teil des Zenno-Tarifs.', buy: 'Kaufen', buying: 'Wird geöffnet…', replies: '{count} Antworten',
    packHint: 'Einmalzahlung. Wird nach Ihren Monatsantworten genutzt.',
    creditsSuccess: 'Danke! Ihre Antworten werden gleich gutgeschrieben.', creditsCancelled: 'Kauf abgebrochen. Es wurde nichts berechnet.',
  },
  th: {
    freePlan: 'ฟรี', zennoPlan: 'Zenno', customPlan: 'แบบกำหนดเอง', upgrade: 'อัปเกรด',
    onFree: 'แพ็กเกจฟรี', onZenno: 'แพ็กเกจ Zenno', onCustom: 'แพ็กเกจกำหนดเอง',
    title: 'แพ็กเกจของคุณ', subtitle: 'แพ็กเกจเดียวครบทุกอย่าง ถ้ามีหลายสาขาหรือต้องการเพิ่มเติม เราจะเสนอราคาให้',
    current: 'แพ็กเกจของคุณ', perMonth: '/ เดือน', vatIncluded: 'รวม VAT', choose: 'อัปเกรดเป็น Zenno', starting: 'กำลังเปิดหน้าชำระเงิน…',
    contact: 'ติดต่อเรา', manage: 'ใบแจ้งหนี้และวิธีชำระเงิน',
    freeLine: 'สำหรับเริ่มต้น', zennoLine: 'ซอฟต์แวร์จองคิวที่จองให้คุณเอง', customLine: 'ออกแบบให้เหมาะกับธุรกิจของคุณ',
    coupon: 'รหัสคูปอง (ไม่บังคับ)', couponPlaceholder: 'ใส่รหัส',
    fFreeTherapist: 'พนักงานบริการ 1 คน', fFreeServices: 'บริการ 5 รายการ', fFreeBooking: 'หน้าจอง ปฏิทิน POS บัตรของขวัญ และการชำระเงิน', fFreeBadge: 'แสดง "Powered by Zenno" บนหน้าจอง',
    fAllTherapists: 'พนักงานและบริการไม่จำกัด', fAi: 'พนักงานต้อนรับ AI บน WhatsApp อีเมล และเว็บไซต์',
    fAiReplies: 'คำตอบ AI 1,000 ครั้งทุกเดือน', fVouchers: 'บัตรของขวัญ การชำระเงิน ค่าปรับ no-show สมุดเงินสด',
    fDomain: 'โดเมนของร้านเอง', fNoBadge: 'ไม่มี "Powered by Zenno"', fSupport: 'ทีมงานช่วยเหลือโดยตรง',
    fCustomAll: 'ทุกอย่างใน Zenno', fCustomLocations: 'หลายสาขาหรือหลายทีม', fCustomReplies: 'คำตอบ AI ตามปริมาณที่ใช้', fCustomSetup: 'เราตั้งค่าและนำเข้าข้อมูลให้',
    upgradeSuccess: 'ขอบคุณค่ะ ร้านของคุณอยู่ในแพ็กเกจ Zenno แล้ว', upgradeCancelled: 'ยกเลิกการชำระเงินแล้ว ไม่มีการเรียกเก็บเงิน',
    paymentIssue: 'การชำระเงินครั้งล่าสุดไม่สำเร็จ กรุณาอัปเดตวิธีชำระเงิน', failed: 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง',
    aiTitle: 'คำตอบ AI', aiHint: 'ทุกคำตอบของพนักงานต้อนรับ AI ใช้ 1 คำตอบ แพ็กเกจรวมจำนวนรายเดือนไว้แล้ว คำตอบที่ซื้อเพิ่มไม่มีวันหมดอายุ',
    aiUsed: 'ใช้ไป {used} จาก {allowance} ในเดือนนี้', aiExtra: '+ คำตอบเพิ่มเติม {count}', aiLeft: 'เหลือ {count} คำตอบ',
    aiEmpty: 'คำตอบหมดแล้ว AI จะหยุดตอบ ข้อความใหม่จะรอทีมงานในกล่องข้อความ',
    aiFree: 'พนักงานต้อนรับ AI เป็นส่วนหนึ่งของแพ็กเกจ Zenno', buy: 'ซื้อ', buying: 'กำลังเปิด…', replies: '{count} คำตอบ',
    packHint: 'ชำระครั้งเดียว ใช้หลังจากคำตอบรายเดือนหมด',
    creditsSuccess: 'ขอบคุณค่ะ คำตอบจะถูกเพิ่มในอีกสักครู่', creditsCancelled: 'ยกเลิกการซื้อแล้ว ไม่มีการเรียกเก็บเงิน',
  },
};

export type BillingText = (typeof BILLING_TEXT)['en'];
