import type { Translations } from '../../../lib/bookingLanguage';

export const CREATE_BOOKING_TEXT: Translations<{
  title: string; close: string; cancel: string;
  service: string; selectService: string; duration: string; durationOption: string;
  therapist: string; dateTime: string; freeTimes: string; loadingTimes: string; noSlots: string; chooseFirst: string;
  timeTaken: string;
  customer: string; searchCustomer: string; searching: string; noMatch: string; newCustomer: string; change: string;
  name: string; email: string; emailHint: string; phone: string;
  notes: string; notesPlaceholder: string; notesHint: string; creating: string; createBooking: string;
  errorMissing: string; errorCustomerFields: string; errorCreate: string; summary: string;
}> = {
  en: {
    title: 'New appointment', close: 'Close', cancel: 'Cancel',
    service: 'Treatment', selectService: 'Choose a treatment', duration: 'Duration', durationOption: '{minutes} min · {price}',
    therapist: 'Therapist', dateTime: 'Day and time', freeTimes: 'Free times', loadingTimes: 'Looking for free times…',
    noSlots: 'No free time on this day. Please pick another day or therapist.', chooseFirst: 'Choose treatment, duration and therapist first.',
    timeTaken: '{time} is not free for this treatment – please pick one of the free times.',
    customer: 'Customer', searchCustomer: 'Search by name, phone or email', searching: 'Searching…', noMatch: 'No customer found.',
    newCustomer: 'New customer', change: 'Change',
    name: 'Name', email: 'Email', emailHint: 'The confirmation is sent here.', phone: 'Phone',
    notes: 'Note for the team (optional)', notesPlaceholder: 'e.g. strong pressure, allergies', notesHint: 'Only your team sees this – never the customer.', creating: 'Saving…', createBooking: 'Add appointment',
    errorMissing: 'Please choose treatment, therapist, time and customer.', errorCustomerFields: 'Please enter name, email and phone of the new customer.',
    errorCreate: 'The appointment could not be saved. Please try again.', summary: '{service} · {date} · {time}',
  },
  de: {
    title: 'Termin eintragen', close: 'Schließen', cancel: 'Abbrechen',
    service: 'Behandlung', selectService: 'Behandlung auswählen', duration: 'Dauer', durationOption: '{minutes} Min. · {price}',
    therapist: 'Therapeut:in', dateTime: 'Tag und Uhrzeit', freeTimes: 'Freie Zeiten', loadingTimes: 'Freie Zeiten werden gesucht…',
    noSlots: 'An diesem Tag ist nichts frei. Bitte anderen Tag oder andere Therapeut:in wählen.', chooseFirst: 'Bitte zuerst Behandlung, Dauer und Therapeut:in wählen.',
    timeTaken: '{time} Uhr ist für diese Behandlung nicht frei – bitte eine der freien Zeiten wählen.',
    customer: 'Kundin / Kunde', searchCustomer: 'Name, Telefon oder E-Mail eingeben', searching: 'Suche läuft…', noMatch: 'Niemand gefunden.',
    newCustomer: 'Neue Kundin / neuer Kunde', change: 'Ändern',
    name: 'Name', email: 'E-Mail', emailHint: 'Hierhin geht die Bestätigung.', phone: 'Telefon',
    notes: 'Notiz fürs Team (optional)', notesPlaceholder: 'z. B. kräftiger Druck, Allergien', notesHint: 'Sieht nur Ihr Team – nie die Kundin / der Kunde.', creating: 'Wird gespeichert…', createBooking: 'Termin eintragen',
    errorMissing: 'Bitte Behandlung, Therapeut:in, Uhrzeit und Kundin / Kunde wählen.', errorCustomerFields: 'Bitte Name, E-Mail und Telefon der neuen Kundin / des neuen Kunden eingeben.',
    errorCreate: 'Der Termin konnte nicht gespeichert werden. Bitte erneut versuchen.', summary: '{service} · {date} · {time} Uhr',
  },
  th: {
    title: 'เพิ่มนัดหมาย', close: 'ปิด', cancel: 'ยกเลิก',
    service: 'บริการ', selectService: 'เลือกบริการ', duration: 'ระยะเวลา', durationOption: '{minutes} นาที · {price}',
    therapist: 'พนักงานบริการ', dateTime: 'วันและเวลา', freeTimes: 'เวลาว่าง', loadingTimes: 'กำลังค้นหาเวลาว่าง…',
    noSlots: 'วันนี้ไม่มีเวลาว่าง กรุณาเลือกวันอื่นหรือพนักงานคนอื่น', chooseFirst: 'กรุณาเลือกบริการ ระยะเวลา และพนักงานก่อน',
    timeTaken: '{time} ไม่ว่างสำหรับบริการนี้ – กรุณาเลือกเวลาที่ว่าง',
    customer: 'ลูกค้า', searchCustomer: 'ค้นหาด้วยชื่อ เบอร์โทร หรืออีเมล', searching: 'กำลังค้นหา…', noMatch: 'ไม่พบลูกค้า',
    newCustomer: 'ลูกค้าใหม่', change: 'เปลี่ยน',
    name: 'ชื่อ', email: 'อีเมล', emailHint: 'ระบบจะส่งการยืนยันไปที่อีเมลนี้', phone: 'โทรศัพท์',
    notes: 'โน้ตสำหรับทีม (ไม่บังคับ)', notesPlaceholder: 'เช่น กดแรง แพ้สาร', notesHint: 'เห็นเฉพาะทีมของคุณ ลูกค้าไม่เห็น', creating: 'กำลังบันทึก…', createBooking: 'เพิ่มนัดหมาย',
    errorMissing: 'กรุณาเลือกบริการ พนักงาน เวลา และลูกค้า', errorCustomerFields: 'กรุณากรอกชื่อ อีเมล และเบอร์โทรของลูกค้าใหม่',
    errorCreate: 'บันทึกนัดหมายไม่สำเร็จ กรุณาลองอีกครั้ง', summary: '{service} · {date} · {time}',
  },
};

export type CreateBookingText = (typeof CREATE_BOOKING_TEXT)['en'];
