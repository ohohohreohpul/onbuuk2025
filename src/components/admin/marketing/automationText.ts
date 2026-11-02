import type { Translations } from '../../../lib/bookingLanguage';
import type { StarterText } from './marketingApi';

type AutomationText = {
  sectionTitle: string; sectionHint: string;
  birthdayTitle: string; birthdayHint: string; winbackTitle: string; winbackHint: string;
  specialTitle: string; specialHint: string; newSpecialDay: string; noSpecialDays: string;
  on: string; off: string; edit: string; setUp: string; birthdaysKnown: string; pendingOptIns: string;
  promotionsTitle: string;
  daysBefore: string; onTheDay: string; daysBeforeOption: string; winbackAfter: string; winbackOption: string;
  sendDate: string; automationOn: string; specialOn: string;
  birthdayScheduleHint: string; winbackScheduleHint: string; specialScheduleHint: string;
  dateRequired: string; datePast: string;
};

export const AUTOMATION_TEXT: Translations<AutomationText> = {
  en: {
    sectionTitle: 'Automatic emails', sectionHint: 'Switch on once; Zenno checks every morning who should get them.',
    birthdayTitle: 'Birthday', birthdayHint: 'A greeting (and a little gift) on the customer\'s birthday.',
    winbackTitle: 'We miss you', winbackHint: 'For customers who haven\'t been back for a while and have nothing booked.',
    specialTitle: 'Special days', specialHint: 'Valentine\'s Day, Mother\'s Day, Christmas: one email on the date you pick.',
    newSpecialDay: 'New special day', noSpecialDays: 'No special day planned yet.',
    on: 'On', off: 'Off', edit: 'Edit', setUp: 'Set up', birthdaysKnown: '{count} customers with a birthday on file',
    pendingOptIns: '{count} waiting for email confirmation',
    promotionsTitle: 'Monthly promotions',
    daysBefore: 'When', onTheDay: 'On the birthday', daysBeforeOption: '{days} days before',
    winbackAfter: 'Send after', winbackOption: '{days} days without a visit',
    sendDate: 'Date', automationOn: 'Send automatically', specialOn: 'Send on this date',
    birthdayScheduleHint: 'Each customer gets it once a year. Birthdays come from the booking form or the customer profile.',
    winbackScheduleHint: 'Each customer gets it once per absence; it stops as soon as they book again.',
    specialScheduleHint: 'Sent once on this date (German time).',
    dateRequired: 'Please choose a date.', datePast: 'Please choose a date in the future.',
  },
  de: {
    sectionTitle: 'Automatische E-Mails', sectionHint: 'Einmal einschalten; Zenno prüft jeden Morgen, wer sie bekommen soll.',
    birthdayTitle: 'Geburtstag', birthdayHint: 'Ein Gruß (und ein kleines Geschenk) am Geburtstag Ihrer Kunden.',
    winbackTitle: 'Wir vermissen Sie', winbackHint: 'Für Kunden, die länger nicht da waren und nichts gebucht haben.',
    specialTitle: 'Besondere Tage', specialHint: 'Valentinstag, Muttertag, Weihnachten: eine E-Mail am Tag Ihrer Wahl.',
    newSpecialDay: 'Neuer besonderer Tag', noSpecialDays: 'Noch kein besonderer Tag geplant.',
    on: 'An', off: 'Aus', edit: 'Bearbeiten', setUp: 'Einrichten', birthdaysKnown: '{count} Kunden mit hinterlegtem Geburtstag',
    pendingOptIns: '{count} warten auf die Bestätigung per E-Mail',
    promotionsTitle: 'Monatliche Aktionen',
    daysBefore: 'Wann', onTheDay: 'Am Geburtstag', daysBeforeOption: '{days} Tage vorher',
    winbackAfter: 'Senden nach', winbackOption: '{days} Tagen ohne Besuch',
    sendDate: 'Datum', automationOn: 'Automatisch senden', specialOn: 'An diesem Tag senden',
    birthdayScheduleHint: 'Jeder Kunde bekommt sie einmal im Jahr. Geburtstage kommen aus dem Buchungsformular oder dem Kundenprofil.',
    winbackScheduleHint: 'Jeder Kunde bekommt sie einmal pro Abwesenheit; sobald er wieder bucht, ist Schluss.',
    specialScheduleHint: 'Wird einmal an diesem Tag versendet (deutsche Zeit).',
    dateRequired: 'Bitte ein Datum wählen.', datePast: 'Bitte ein Datum in der Zukunft wählen.',
  },
  th: {
    sectionTitle: 'อีเมลอัตโนมัติ', sectionHint: 'เปิดครั้งเดียว Zenno จะตรวจทุกเช้าว่าควรส่งถึงใคร',
    birthdayTitle: 'วันเกิด', birthdayHint: 'ส่งคำอวยพร (และของขวัญเล็ก ๆ) ในวันเกิดลูกค้า',
    winbackTitle: 'คิดถึงคุณ', winbackHint: 'สำหรับลูกค้าที่ไม่ได้มานานและยังไม่มีนัด',
    specialTitle: 'วันพิเศษ', specialHint: 'วาเลนไทน์ วันแม่ คริสต์มาส: ส่งอีเมลหนึ่งฉบับในวันที่คุณเลือก',
    newSpecialDay: 'วันพิเศษใหม่', noSpecialDays: 'ยังไม่มีวันพิเศษ',
    on: 'เปิด', off: 'ปิด', edit: 'แก้ไข', setUp: 'ตั้งค่า', birthdaysKnown: 'ลูกค้า {count} คนมีข้อมูลวันเกิด',
    pendingOptIns: '{count} คนรอยืนยันทางอีเมล',
    promotionsTitle: 'โปรโมชันรายเดือน',
    daysBefore: 'เมื่อไร', onTheDay: 'ในวันเกิด', daysBeforeOption: 'ล่วงหน้า {days} วัน',
    winbackAfter: 'ส่งหลังจาก', winbackOption: 'ไม่ได้มา {days} วัน',
    sendDate: 'วันที่', automationOn: 'ส่งอัตโนมัติ', specialOn: 'ส่งในวันนี้',
    birthdayScheduleHint: 'ลูกค้าแต่ละคนได้รับปีละครั้ง วันเกิดมาจากแบบฟอร์มจองหรือโปรไฟล์ลูกค้า',
    winbackScheduleHint: 'ลูกค้าแต่ละคนได้รับครั้งเดียวต่อช่วงที่หายไป และหยุดทันทีเมื่อจองใหม่',
    specialScheduleHint: 'ส่งครั้งเดียวในวันนี้ (เวลาเยอรมนี)',
    dateRequired: 'กรุณาเลือกวันที่', datePast: 'กรุณาเลือกวันที่ในอนาคต',
  },
};

export type StarterKind = 'birthday' | 'winback' | 'special_day';

/** Ready-to-edit first version of each automatic email, in the admin's language. */
export const AUTOMATION_STARTERS: Record<'en' | 'de' | 'th', Record<StarterKind, StarterText>> = {
  en: {
    birthday: { subject: 'Happy birthday, {vorname}!', headline: 'Happy birthday!', text: 'Hello {vorname},\n\nall the best for your birthday! Treat yourself to some time out with us. As a little gift, mention this email at your next visit.', button: 'Book now' },
    winback: { subject: 'We miss you, {vorname}', headline: 'Time for a break?', text: 'Hello {vorname},\n\nit\'s been a while since your last visit. We\'d love to see you again. Book your next appointment in just a few clicks.', button: 'Book an appointment' },
    special_day: { subject: 'A special gift idea', headline: 'Give some relaxation', text: 'Hello {vorname},\n\nlooking for a gift? A voucher from us is always a good idea.', button: 'Buy a voucher' },
  },
  de: {
    birthday: { subject: 'Alles Gute zum Geburtstag, {vorname}!', headline: 'Alles Gute zum Geburtstag!', text: 'Hallo {vorname},\n\nwir wünschen Ihnen alles Liebe zum Geburtstag! Gönnen Sie sich eine Auszeit bei uns. Als kleines Geschenk: Zeigen Sie diese E-Mail bei Ihrem nächsten Besuch.', button: 'Jetzt buchen' },
    winback: { subject: 'Wir vermissen Sie, {vorname}', headline: 'Zeit für eine Auszeit?', text: 'Hallo {vorname},\n\nIhr letzter Besuch ist schon eine Weile her. Wir würden uns freuen, Sie wiederzusehen. Ihren nächsten Termin buchen Sie mit wenigen Klicks.', button: 'Termin buchen' },
    special_day: { subject: 'Eine besondere Geschenkidee', headline: 'Entspannung verschenken', text: 'Hallo {vorname},\n\nSie suchen noch ein Geschenk? Ein Gutschein von uns kommt immer gut an.', button: 'Gutschein kaufen' },
  },
  th: {
    birthday: { subject: 'Alles Gute zum Geburtstag, {vorname}!', headline: 'Alles Gute zum Geburtstag!', text: 'Hallo {vorname},\n\nwir wünschen Ihnen alles Liebe zum Geburtstag! Gönnen Sie sich eine Auszeit bei uns.', button: 'Jetzt buchen' },
    winback: { subject: 'Wir vermissen Sie, {vorname}', headline: 'Zeit für eine Auszeit?', text: 'Hallo {vorname},\n\nIhr letzter Besuch ist schon eine Weile her. Wir würden uns freuen, Sie wiederzusehen.', button: 'Termin buchen' },
    special_day: { subject: 'Eine besondere Geschenkidee', headline: 'Entspannung verschenken', text: 'Hallo {vorname},\n\nSie suchen noch ein Geschenk? Ein Gutschein von uns kommt immer gut an.', button: 'Gutschein kaufen' },
  },
};
