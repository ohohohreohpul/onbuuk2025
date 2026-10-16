import type { Translations } from '../../../lib/bookingLanguage';

/** All words of the calendar workspace in one place (EN / DE / TH). */
export const CALENDAR_TEXT: Translations<{
  title: string; loadFailed: string; retry: string;
  today: string; previous: string; next: string;
  viewDay: string; viewWeek: string; viewMonth: string;
  newBooking: string; blockTime: string; redeemVoucher: string; sellVoucher: string;
  hint: string; everyone: string; showStaff: string;
  shopClosed: string; notWorking: string; blocked: string; noStaff: string;
  waitingConfirm: string; paid: string; noShow: string; done: string; people: string;
  appointmentsOne: string; appointmentsMany: string; freeDay: string;
  slotTitle: string; slotQuestion: string;
  slotBook: string; slotBookHint: string; slotBlock: string; slotBlockHint: string; close: string; cancel: string;
  blockTitle: string; blockEditTitle: string; who: string; wholeShop: string; wholeShopHint: string;
  date: string; from: string; until: string; wholeDay: string; reason: string; reasonOther: string;
  reasonBreak: string; reasonHoliday: string; reasonSick: string; reasonAppointment: string; reasonClosed: string;
  save: string; saving: string; deleteBlock: string; deleteConfirm: string;
  errorRange: string; errorSave: string; errorDelete: string; errorWho: string;
  move: string; voucherTitle: string; minutes: string;
  severalDays: string; lastDay: string; confirmDelete: string; unassigned: string;
  comment: string; commentPlaceholder: string; color: string; noColor: string; durationLabel: string;
  convert: string; convertHint: string; errorRemoveReservation: string;
}> = {
  en: {
    title: 'Calendar', loadFailed: 'The calendar could not be loaded.', retry: 'Try again',
    today: 'Today', previous: 'Back', next: 'Forward',
    viewDay: 'Day', viewWeek: 'Week', viewMonth: 'Month',
    newBooking: 'New appointment', blockTime: 'Block time', redeemVoucher: 'Redeem voucher', sellVoucher: 'Sell voucher',
    hint: 'Tip: click an empty spot in the calendar to add an appointment or block time.',
    everyone: 'Everyone', showStaff: 'Show therapists',
    shopClosed: 'Shop closed', notWorking: 'Not working', blocked: 'Blocked', noStaff: 'No therapists yet. Add them under Specialists.',
    waitingConfirm: 'Please confirm', paid: 'Paid', noShow: 'Did not come', done: 'Done', people: '2 people',
    appointmentsOne: '1 appointment', appointmentsMany: '{count} appointments', freeDay: 'No appointments',
    slotTitle: '{date} · {time}', slotQuestion: 'What would you like to do?',
    slotBook: 'Add appointment', slotBookHint: 'Book a customer at this time',
    slotBlock: 'Block time', slotBlockHint: 'Break, holiday, doctor … nobody can book then',
    close: 'Close', cancel: 'Cancel',
    blockTitle: 'Block time', blockEditTitle: 'Blocked time', who: 'Who?', wholeShop: 'Whole shop', wholeShopHint: 'The shop is closed – nobody can book.',
    date: 'Date', from: 'From', until: 'Until', wholeDay: 'Whole day', reason: 'Reason', reasonOther: 'Other reason (optional)',
    reasonBreak: 'Break', reasonHoliday: 'Holiday', reasonSick: 'Sick', reasonAppointment: 'Private appointment', reasonClosed: 'Closed',
    save: 'Save', saving: 'Saving…', deleteBlock: 'Remove block', deleteConfirm: 'Remove this blocked time? Customers can then book again.',
    errorRange: '"Until" must be after "From".', errorSave: 'Could not save. Please try again.', errorDelete: 'Could not remove. Please try again.',
    errorWho: 'Please choose who is blocked.',
    move: 'Move appointment', voucherTitle: 'Redeem voucher', minutes: '{count} min',
    severalDays: 'Several days', lastDay: 'Last day', confirmDelete: 'Yes, remove', unassigned: 'Not assigned',
    comment: 'Comment', commentPlaceholder: 'e.g. Ms Weber · back & neck · 0151 2345 6789', color: 'Colour', noColor: 'Grey', durationLabel: 'Duration: {hours} h {minutes} min', convert: 'Turn into a real appointment', convertHint: 'Customer gets a confirmation and reminder; payment and stats are tracked.', errorRemoveReservation: 'The appointment is saved, but the reservation is still there – please remove it.',
  },
  de: {
    title: 'Kalender', loadFailed: 'Der Kalender konnte nicht geladen werden.', retry: 'Erneut versuchen',
    today: 'Heute', previous: 'Zurück', next: 'Weiter',
    viewDay: 'Tag', viewWeek: 'Woche', viewMonth: 'Monat',
    newBooking: 'Termin eintragen', blockTime: 'Zeit blockieren', redeemVoucher: 'Gutschein einlösen', sellVoucher: 'Gutschein verkaufen',
    hint: 'Tipp: Auf eine freie Stelle im Kalender klicken, um einen Termin einzutragen oder Zeit zu blockieren.',
    everyone: 'Alle', showStaff: 'Therapeut:innen anzeigen',
    shopClosed: 'Geschlossen', notWorking: 'Nicht im Dienst', blocked: 'Blockiert', noStaff: 'Noch keine Therapeut:innen. Bitte unter „Therapeut:innen“ anlegen.',
    waitingConfirm: 'Bitte bestätigen', paid: 'Bezahlt', noShow: 'Nicht gekommen', done: 'Erledigt', people: '2 Personen',
    appointmentsOne: '1 Termin', appointmentsMany: '{count} Termine', freeDay: 'Keine Termine',
    slotTitle: '{date} · {time} Uhr', slotQuestion: 'Was möchten Sie tun?',
    slotBook: 'Termin eintragen', slotBookHint: 'Eine Kundin oder einen Kunden zu dieser Zeit buchen',
    slotBlock: 'Zeit blockieren', slotBlockHint: 'Pause, Urlaub, Arzttermin … dann kann niemand buchen',
    close: 'Schließen', cancel: 'Abbrechen',
    blockTitle: 'Zeit blockieren', blockEditTitle: 'Blockierte Zeit', who: 'Wer?', wholeShop: 'Ganzer Laden', wholeShopHint: 'Der Laden ist geschlossen – niemand kann buchen.',
    date: 'Datum', from: 'Von', until: 'Bis', wholeDay: 'Ganzer Tag', reason: 'Grund', reasonOther: 'Anderer Grund (optional)',
    reasonBreak: 'Pause', reasonHoliday: 'Urlaub', reasonSick: 'Krank', reasonAppointment: 'Privater Termin', reasonClosed: 'Geschlossen',
    save: 'Speichern', saving: 'Wird gespeichert…', deleteBlock: 'Blockierung entfernen', deleteConfirm: 'Diese blockierte Zeit entfernen? Dann kann wieder gebucht werden.',
    errorRange: '„Bis“ muss nach „Von“ liegen.', errorSave: 'Speichern fehlgeschlagen. Bitte erneut versuchen.', errorDelete: 'Entfernen fehlgeschlagen. Bitte erneut versuchen.',
    errorWho: 'Bitte auswählen, wer blockiert wird.',
    move: 'Termin verschieben', voucherTitle: 'Gutschein einlösen', minutes: '{count} Min.',
    severalDays: 'Mehrere Tage', lastDay: 'Letzter Tag', confirmDelete: 'Ja, entfernen', unassigned: 'Ohne Zuordnung',
    comment: 'Kommentar', commentPlaceholder: 'z. B. Fr. Weber · Rücken/Nacken · 0151 2345 6789', color: 'Farbe', noColor: 'Grau', durationLabel: 'Dauer: {hours} Std. {minutes} Min.', convert: 'Als richtigen Termin eintragen', convertHint: 'Die Kundin bekommt Bestätigung und Erinnerung; Zahlung und Statistik werden erfasst.', errorRemoveReservation: 'Der Termin ist gespeichert, aber die Reservierung ist noch da – bitte entfernen.',
  },
  th: {
    title: 'ปฏิทิน', loadFailed: 'โหลดปฏิทินไม่สำเร็จ', retry: 'ลองอีกครั้ง',
    today: 'วันนี้', previous: 'ย้อนกลับ', next: 'ถัดไป',
    viewDay: 'วัน', viewWeek: 'สัปดาห์', viewMonth: 'เดือน',
    newBooking: 'เพิ่มนัดหมาย', blockTime: 'ปิดเวลา', redeemVoucher: 'ใช้บัตรของขวัญ', sellVoucher: 'ขายบัตรของขวัญ',
    hint: 'เคล็ดลับ: คลิกที่ช่องว่างในปฏิทินเพื่อเพิ่มนัดหมายหรือปิดเวลา',
    everyone: 'ทุกคน', showStaff: 'แสดงพนักงาน',
    shopClosed: 'ร้านปิด', notWorking: 'ไม่ได้ทำงาน', blocked: 'ปิดเวลา', noStaff: 'ยังไม่มีพนักงาน กรุณาเพิ่มที่เมนูพนักงานบริการ',
    waitingConfirm: 'รอยืนยัน', paid: 'ชำระแล้ว', noShow: 'ไม่มา', done: 'เสร็จแล้ว', people: '2 คน',
    appointmentsOne: '1 นัดหมาย', appointmentsMany: '{count} นัดหมาย', freeDay: 'ไม่มีนัดหมาย',
    slotTitle: '{date} · {time}', slotQuestion: 'ต้องการทำอะไร?',
    slotBook: 'เพิ่มนัดหมาย', slotBookHint: 'จองให้ลูกค้าในเวลานี้',
    slotBlock: 'ปิดเวลา', slotBlockHint: 'พัก ลาพักร้อน ไปหาหมอ … ลูกค้าจะจองไม่ได้',
    close: 'ปิด', cancel: 'ยกเลิก',
    blockTitle: 'ปิดเวลา', blockEditTitle: 'เวลาที่ปิดไว้', who: 'ใคร?', wholeShop: 'ทั้งร้าน', wholeShopHint: 'ร้านปิด – ไม่มีใครจองได้',
    date: 'วันที่', from: 'ตั้งแต่', until: 'ถึง', wholeDay: 'ทั้งวัน', reason: 'เหตุผล', reasonOther: 'เหตุผลอื่น (ไม่บังคับ)',
    reasonBreak: 'พัก', reasonHoliday: 'ลาพักร้อน', reasonSick: 'ลาป่วย', reasonAppointment: 'ธุระส่วนตัว', reasonClosed: 'ร้านปิด',
    save: 'บันทึก', saving: 'กำลังบันทึก…', deleteBlock: 'ยกเลิกการปิดเวลา', deleteConfirm: 'ยกเลิกการปิดเวลานี้? ลูกค้าจะจองได้อีกครั้ง',
    errorRange: 'เวลา "ถึง" ต้องอยู่หลังเวลา "ตั้งแต่"', errorSave: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง', errorDelete: 'ยกเลิกไม่สำเร็จ กรุณาลองอีกครั้ง',
    errorWho: 'กรุณาเลือกว่าปิดเวลาของใคร',
    move: 'เลื่อนนัด', voucherTitle: 'ใช้บัตรของขวัญ', minutes: '{count} นาที',
    severalDays: 'หลายวัน', lastDay: 'วันสุดท้าย', confirmDelete: 'ใช่ ยกเลิก', unassigned: 'ยังไม่ระบุพนักงาน',
    comment: 'หมายเหตุ', commentPlaceholder: 'เช่น คุณ Weber · หลัง/คอ · 0151 2345 6789', color: 'สี', noColor: 'เทา', durationLabel: 'ระยะเวลา: {hours} ชม. {minutes} นาที', convert: 'เปลี่ยนเป็นนัดหมายจริง', convertHint: 'ลูกค้าจะได้รับการยืนยันและการแจ้งเตือน ระบบบันทึกการชำระเงินและสถิติ', errorRemoveReservation: 'บันทึกนัดหมายแล้ว แต่เวลาที่ปิดไว้ยังอยู่ – กรุณาลบออก',
  },
};

export type CalendarText = (typeof CALENDAR_TEXT)['en'];
