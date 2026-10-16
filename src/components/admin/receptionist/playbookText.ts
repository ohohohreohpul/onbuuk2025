import type { Translations } from '../../../lib/bookingLanguage';

export const SITUATIONS = [
  'greeting', 'booking_order', 'price_question', 'no_free_time', 'after_booking', 'voucher_question', 'handover', 'goodbye',
] as const;
export type Situation = (typeof SITUATIONS)[number];

type SituationText = Record<`${Situation}Title` | `${Situation}Example`, string>;
type Keys = SituationText & {
  tab: string; title: string; hint: string; edit: string; save: string; cancel: string; close: string; saving: string; saveFailed: string;
  placeholders: string; useSuggestion: string; tryIt: string; off: string; example: string;
};

export const PLAYBOOK_TEXT: Translations<Keys> = {
  en: {
    tab: 'How it talks', title: 'How the receptionist talks', hint: 'Switch on the situations you care about and show in one or two sentences how you would answer. The AI keeps your tone and order and fills in the real prices and times.',
    edit: 'Edit', save: 'Save', cancel: 'Cancel', close: 'Close', saving: 'Saving…', saveFailed: 'Could not save. Please try again.',
    placeholders: 'Placeholders: {assistant} = assistant name, {shop} = shop name, {name} = customer name', useSuggestion: 'Use suggestion', tryIt: 'Try it in the chat', off: 'Not used', example: 'Example answer',
    greetingTitle: 'First message', greetingExample: 'Hi, I\'m {assistant} from {shop}. Thanks for your message! What can I do for you, a massage, a facial or a voucher?',
    booking_orderTitle: 'Booking: what to ask, in which order', booking_orderExample: 'First the treatment, then the day and time, then name and phone number. Then a short summary and ask for an OK.',
    price_questionTitle: 'Questions about prices', price_questionExample: 'The 60-minute Thai massage is 70 €. Would you like me to look for a time?',
    no_free_timeTitle: 'Nothing free at that time', no_free_timeExample: 'At 3 pm we\'re fully booked, sorry. I could do 4:30 pm or tomorrow at 11. Would one of those work?',
    after_bookingTitle: 'After a booking', after_bookingExample: 'Done, you\'re booked for Saturday at 2 pm. You\'ll get a confirmation by email. See you then!',
    voucher_questionTitle: 'Vouchers', voucher_questionExample: 'We have vouchers from 25 €, and sets as well. You can buy them online here or in the shop.',
    handoverTitle: 'Unsure / handing over', handoverExample: 'Good question, I\'ll pass it on to my colleague. They\'ll get back to you shortly.',
    goodbyeTitle: 'Goodbye', goodbyeExample: 'You\'re welcome, have a lovely day!',
  },
  de: {
    tab: 'Wie sie spricht', title: 'So spricht die Rezeption', hint: 'Schalten Sie die Situationen ein, die Ihnen wichtig sind, und zeigen Sie in ein, zwei Sätzen, wie Sie antworten würden. Die KI übernimmt Ton und Reihenfolge und setzt echte Preise und Zeiten ein.',
    edit: 'Bearbeiten', save: 'Speichern', cancel: 'Abbrechen', close: 'Schließen', saving: 'Wird gespeichert…', saveFailed: 'Speichern fehlgeschlagen. Bitte erneut versuchen.',
    placeholders: 'Platzhalter: {assistant} = Name der Assistentin, {shop} = Name des Ladens, {name} = Name der Kundin / des Kunden', useSuggestion: 'Vorschlag übernehmen', tryIt: 'Im Chat ausprobieren', off: 'Nicht genutzt', example: 'Beispielantwort',
    greetingTitle: 'Erste Nachricht', greetingExample: 'Hi, ich bin {assistant} von {shop}. Danke für deine Nachricht! Wobei kann ich dir helfen, eher Massage, Gesichtsbehandlung oder ein Gutschein?',
    booking_orderTitle: 'Buchung: was in welcher Reihenfolge fragen', booking_orderExample: 'Erst die Behandlung, dann Tag und Uhrzeit, dann Name und Telefonnummer. Danach kurz zusammenfassen und um ein OK bitten.',
    price_questionTitle: 'Fragen nach Preisen', price_questionExample: 'Die Thai-Massage mit 60 Minuten kostet 70 €. Soll ich dir einen Termin raussuchen?',
    no_free_timeTitle: 'Zur Wunschzeit nichts frei', no_free_timeExample: 'Um 15 Uhr sind wir leider voll. Ich hätte 16:30 Uhr oder morgen um 11 Uhr. Passt dir eins davon?',
    after_bookingTitle: 'Nach einer Buchung', after_bookingExample: 'Erledigt, du bist am Samstag um 14 Uhr eingetragen. Die Bestätigung kommt per E-Mail. Bis dann!',
    voucher_questionTitle: 'Gutscheine', voucher_questionExample: 'Gutscheine gibt es ab 25 €, auch als Set. Du kannst sie hier online oder bei uns im Laden kaufen.',
    handoverTitle: 'Unsicher / an Team übergeben', handoverExample: 'Gute Frage, das gebe ich an meine Kollegin weiter. Sie meldet sich gleich bei dir.',
    goodbyeTitle: 'Verabschiedung', goodbyeExample: 'Sehr gerne, einen schönen Tag dir!',
  },
  th: {
    tab: 'วิธีพูด', title: 'วิธีที่ AI พูดกับลูกค้า', hint: 'เปิดสถานการณ์ที่สำคัญ แล้วเขียนตัวอย่างคำตอบสั้นๆ หนึ่งหรือสองประโยค AI จะใช้น้ำเสียงและลำดับของคุณ และใส่ราคาและเวลาจริงให้',
    edit: 'แก้ไข', save: 'บันทึก', cancel: 'ยกเลิก', close: 'ปิด', saving: 'กำลังบันทึก…', saveFailed: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง',
    placeholders: 'ตัวแทนข้อความ: {assistant} = ชื่อผู้ช่วย, {shop} = ชื่อร้าน, {name} = ชื่อลูกค้า', useSuggestion: 'ใช้คำแนะนำ', tryIt: 'ลองในแชท', off: 'ไม่ได้ใช้', example: 'ตัวอย่างคำตอบ',
    greetingTitle: 'ข้อความแรก', greetingExample: 'สวัสดีค่ะ ฉันชื่อ {assistant} จาก {shop} ขอบคุณที่ทักมานะคะ สนใจนวด ทรีตเมนต์หน้า หรือบัตรของขวัญคะ?',
    booking_orderTitle: 'การจอง: ถามอะไร ตามลำดับไหน', booking_orderExample: 'ถามบริการก่อน แล้ววันและเวลา แล้วชื่อและเบอร์โทร จากนั้นสรุปสั้นๆ และขอคำยืนยัน',
    price_questionTitle: 'ถามราคา', price_questionExample: 'นวดไทย 60 นาที ราคา 70 ยูโรค่ะ ให้ช่วยหาเวลาว่างให้ไหมคะ?',
    no_free_timeTitle: 'เวลาที่ต้องการไม่ว่าง', no_free_timeExample: 'บ่ายสามเต็มแล้วค่ะ มีว่าง 16:30 หรือพรุ่งนี้ 11 โมง สะดวกเวลาไหนคะ?',
    after_bookingTitle: 'หลังจองเสร็จ', after_bookingExample: 'เรียบร้อยค่ะ จองไว้วันเสาร์บ่ายสองโมงนะคะ จะมีอีเมลยืนยันส่งไป แล้วพบกันค่ะ',
    voucher_questionTitle: 'บัตรของขวัญ', voucher_questionExample: 'มีบัตรของขวัญเริ่มต้น 25 ยูโร และแบบเซ็ตด้วยค่ะ ซื้อออนไลน์หรือที่ร้านก็ได้ค่ะ',
    handoverTitle: 'ไม่แน่ใจ / ส่งต่อให้ทีม', handoverExample: 'ขอส่งต่อให้เพื่อนร่วมงานนะคะ เดี๋ยวจะติดต่อกลับเร็วๆ นี้ค่ะ',
    goodbyeTitle: 'บอกลา', goodbyeExample: 'ยินดีค่ะ ขอให้เป็นวันที่ดีนะคะ',
  },
};
