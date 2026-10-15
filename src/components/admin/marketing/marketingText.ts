import type { Translations } from '../../../lib/bookingLanguage';

export const MARKETING_TEXT: Translations<{
  title: string; subtitle: string; newCampaign: string; noCampaigns: string; noCampaignsHint: string;
  subscribers: string; allCustomers: string; unsubscribed: string; reach: string;
  subject: string; subjectPlaceholder: string; body: string; bodyHint: string; bodyPlaceholder: string;
  buttonText: string; buttonUrl: string; buttonOptional: string; audience: string;
  audienceSubscribers: string; audienceSubscribersHint: string; audienceAll: string; audienceAllHint: string;
  schedule: string; dayOfMonth: string; hour: string; monthlyOn: string; monthlyOff: string; monthlyHint: string;
  nextSend: string; save: string; saving: string; saved: string; delete: string; confirmDelete: string;
  testTitle: string; testSend: string; testSending: string; testSent: string; sendNow: string; confirmSendNow: string;
  queued: string; history: string; noHistory: string; runMonthly: string; runNow: string; runTest: string;
  sent: string; failed: string; pending: string; skipped: string; edit: string; active: string; paused: string;
  loadFailed: string; saveFailed: string; testFailed: string; sendFailed: string; required: string; httpsOnly: string;
  legalNote: string;
}> = {
  en: {
    title: 'Email marketing', subtitle: 'Send your customers a promotion once a month, automatically and in your shop\'s name.',
    newCampaign: 'New promotion', noCampaigns: 'No promotion yet', noCampaignsHint: 'Write one email; Zenno sends it every month on the day you choose.',
    subscribers: 'Newsletter subscribers', allCustomers: 'Customers with email', unsubscribed: 'Unsubscribed', reach: '{count} recipients',
    subject: 'Subject', subjectPlaceholder: 'e.g. Your break in November – save with a 5-visit card',
    body: 'Text', bodyHint: 'Blank line = new paragraph. {vorname} inserts the customer\'s first name.',
    bodyPlaceholder: 'Hello {vorname},\n\n…', buttonText: 'Button text', buttonUrl: 'Button link (https://…)', buttonOptional: 'Button (optional)',
    audience: 'Who receives it?', audienceSubscribers: 'Newsletter subscribers only', audienceSubscribersHint: 'Customers who signed up for the newsletter.',
    audienceAll: 'All customers with email', audienceAllHint: 'Everyone except those who unsubscribed. Only if you have their consent.',
    schedule: 'Schedule', dayOfMonth: 'Day of month', hour: 'Time', monthlyOn: 'Send automatically every month', monthlyOff: 'Paused',
    monthlyHint: 'Sent on this day each month (German time). Edit the text any time; the next send uses the latest version.',
    nextSend: 'Next send: {date}', save: 'Save', saving: 'Saving…', saved: 'Saved', delete: 'Delete',
    confirmDelete: 'Delete this promotion? Its send history is deleted too.',
    testTitle: 'Send a test', testSend: 'Send test', testSending: 'Sending…', testSent: 'Test sent to {email}',
    sendNow: 'Send now', confirmSendNow: 'Send this email now to {count} recipients?', queued: '{count} emails are being sent (in batches, a few minutes).',
    history: 'Sent so far', noHistory: 'Nothing sent yet.', runMonthly: 'Monthly · {month}', runNow: 'Sent manually · {day}', runTest: 'Test',
    sent: 'sent', failed: 'failed', pending: 'in progress', skipped: 'skipped', edit: 'Edit', active: 'Monthly', paused: 'Paused',
    loadFailed: 'Could not load email marketing.', saveFailed: 'Could not save: {reason}', testFailed: 'Test email failed: {reason}',
    sendFailed: 'Could not start sending: {reason}', required: 'Subject and text are required.', httpsOnly: 'The button link must start with https://',
    legalNote: 'Every email includes your address and an unsubscribe link. Unsubscribed customers never receive promotions again.',
  },
  de: {
    title: 'E-Mail-Marketing', subtitle: 'Einmal im Monat ein Angebot an Ihre Kunden – automatisch und im Namen Ihres Shops.',
    newCampaign: 'Neue Aktion', noCampaigns: 'Noch keine Aktion', noCampaignsHint: 'Schreiben Sie eine E-Mail; Zenno versendet sie jeden Monat am gewählten Tag.',
    subscribers: 'Newsletter-Abonnenten', allCustomers: 'Kunden mit E-Mail', unsubscribed: 'Abgemeldet', reach: '{count} Empfänger',
    subject: 'Betreff', subjectPlaceholder: 'z. B. Ihre Auszeit im November – jetzt mit 5er-Karte sparen',
    body: 'Text', bodyHint: 'Leerzeile = neuer Absatz. {vorname} setzt den Vornamen der Kundin bzw. des Kunden ein.',
    bodyPlaceholder: 'Hallo {vorname},\n\n…', buttonText: 'Button-Text', buttonUrl: 'Button-Link (https://…)', buttonOptional: 'Button (optional)',
    audience: 'Wer erhält die E-Mail?', audienceSubscribers: 'Nur Newsletter-Abonnenten', audienceSubscribersHint: 'Kunden, die den Newsletter abonniert haben.',
    audienceAll: 'Alle Kunden mit E-Mail', audienceAllHint: 'Alle außer Abgemeldeten. Nur mit entsprechender Einwilligung.',
    schedule: 'Zeitplan', dayOfMonth: 'Tag im Monat', hour: 'Uhrzeit', monthlyOn: 'Jeden Monat automatisch senden', monthlyOff: 'Pausiert',
    monthlyHint: 'Versand an diesem Tag jeden Monat (deutsche Zeit). Den Text können Sie jederzeit ändern; versendet wird immer die aktuelle Fassung.',
    nextSend: 'Nächster Versand: {date}', save: 'Speichern', saving: 'Wird gespeichert…', saved: 'Gespeichert', delete: 'Löschen',
    confirmDelete: 'Diese Aktion löschen? Der Versandverlauf wird ebenfalls gelöscht.',
    testTitle: 'Test senden', testSend: 'Test senden', testSending: 'Wird gesendet…', testSent: 'Test an {email} gesendet',
    sendNow: 'Jetzt senden', confirmSendNow: 'Diese E-Mail jetzt an {count} Empfänger senden?', queued: '{count} E-Mails werden versendet (in Paketen, einige Minuten).',
    history: 'Bisher versendet', noHistory: 'Noch nichts versendet.', runMonthly: 'Monatlich · {month}', runNow: 'Manuell · {day}', runTest: 'Test',
    sent: 'gesendet', failed: 'fehlgeschlagen', pending: 'in Arbeit', skipped: 'übersprungen', edit: 'Bearbeiten', active: 'Monatlich', paused: 'Pausiert',
    loadFailed: 'E-Mail-Marketing konnte nicht geladen werden.', saveFailed: 'Speichern fehlgeschlagen: {reason}', testFailed: 'Test-E-Mail fehlgeschlagen: {reason}',
    sendFailed: 'Versand konnte nicht gestartet werden: {reason}', required: 'Betreff und Text sind Pflichtfelder.', httpsOnly: 'Der Button-Link muss mit https:// beginnen.',
    legalNote: 'Jede E-Mail enthält Ihre Adresse und einen Abmeldelink. Abgemeldete Kunden erhalten nie wieder Angebote.',
  },
  th: {
    title: 'อีเมลการตลาด', subtitle: 'ส่งโปรโมชันถึงลูกค้าเดือนละครั้ง อัตโนมัติ ในนามร้านของคุณ',
    newCampaign: 'โปรโมชันใหม่', noCampaigns: 'ยังไม่มีโปรโมชัน', noCampaignsHint: 'เขียนอีเมลครั้งเดียว Zenno จะส่งให้ทุกเดือนตามวันที่เลือก',
    subscribers: 'ผู้สมัครรับข่าวสาร', allCustomers: 'ลูกค้าที่มีอีเมล', unsubscribed: 'ยกเลิกรับแล้ว', reach: 'ผู้รับ {count} คน',
    subject: 'หัวเรื่อง', subjectPlaceholder: 'เช่น Ihre Auszeit im November – jetzt mit 5er-Karte sparen',
    body: 'ข้อความ', bodyHint: 'เว้นบรรทัด = ย่อหน้าใหม่  {vorname} จะแทนด้วยชื่อลูกค้า',
    bodyPlaceholder: 'Hallo {vorname},\n\n…', buttonText: 'ข้อความบนปุ่ม', buttonUrl: 'ลิงก์ของปุ่ม (https://…)', buttonOptional: 'ปุ่ม (ไม่บังคับ)',
    audience: 'ส่งถึงใคร', audienceSubscribers: 'เฉพาะผู้สมัครรับข่าวสาร', audienceSubscribersHint: 'ลูกค้าที่สมัครรับนิวส์เลตเตอร์',
    audienceAll: 'ลูกค้าทุกคนที่มีอีเมล', audienceAllHint: 'ทุกคนยกเว้นผู้ที่ยกเลิกแล้ว ใช้เมื่อได้รับความยินยอมเท่านั้น',
    schedule: 'กำหนดการส่ง', dayOfMonth: 'วันที่ของเดือน', hour: 'เวลา', monthlyOn: 'ส่งอัตโนมัติทุกเดือน', monthlyOff: 'หยุดชั่วคราว',
    monthlyHint: 'ส่งในวันนี้ของทุกเดือน (เวลาเยอรมนี) แก้ไขข้อความได้ตลอด ระบบจะส่งฉบับล่าสุด',
    nextSend: 'ส่งครั้งถัดไป: {date}', save: 'บันทึก', saving: 'กำลังบันทึก…', saved: 'บันทึกแล้ว', delete: 'ลบ',
    confirmDelete: 'ลบโปรโมชันนี้? ประวัติการส่งจะถูกลบด้วย',
    testTitle: 'ส่งอีเมลทดสอบ', testSend: 'ส่งทดสอบ', testSending: 'กำลังส่ง…', testSent: 'ส่งอีเมลทดสอบไปที่ {email} แล้ว',
    sendNow: 'ส่งตอนนี้', confirmSendNow: 'ส่งอีเมลนี้ตอนนี้ถึงผู้รับ {count} คน?', queued: 'กำลังส่ง {count} อีเมล (ทยอยส่ง ใช้เวลาไม่กี่นาที)',
    history: 'ประวัติการส่ง', noHistory: 'ยังไม่ได้ส่ง', runMonthly: 'รายเดือน · {month}', runNow: 'ส่งเอง · {day}', runTest: 'ทดสอบ',
    sent: 'ส่งแล้ว', failed: 'ไม่สำเร็จ', pending: 'กำลังส่ง', skipped: 'ข้าม', edit: 'แก้ไข', active: 'รายเดือน', paused: 'หยุดชั่วคราว',
    loadFailed: 'โหลดอีเมลการตลาดไม่สำเร็จ', saveFailed: 'บันทึกไม่สำเร็จ: {reason}', testFailed: 'ส่งอีเมลทดสอบไม่สำเร็จ: {reason}',
    sendFailed: 'เริ่มส่งไม่สำเร็จ: {reason}', required: 'ต้องกรอกหัวเรื่องและข้อความ', httpsOnly: 'ลิงก์ของปุ่มต้องขึ้นต้นด้วย https://',
    legalNote: 'ทุกอีเมลมีที่อยู่ร้านและลิงก์ยกเลิกรับ ลูกค้าที่ยกเลิกแล้วจะไม่ได้รับโปรโมชันอีก',
  },
};
