import type { Translations } from '../../../lib/bookingLanguage';

export const INVOICE_GUIDE_TEXT: Translations<{
  title: string; close: string; stepOf: string; back: string; next: string; done: string; loading: string; loadFailed: string;
  taxTitle: string; taxBody: string; taxId: string; taxIdMissing: string; invoiceName: string; smallBusiness: string;
  smallBusinessYes: string; smallBusinessNo: string; openInvoiceSettings: string;
  addressTitle: string; addressBody: string; street: string; postcode: string; city: string; notFound: string;
  addressHint: string; addressOk: string; openStoreProfile: string;
  issueTitle: string; issueBody: string; issueSteps: string; reprintNote: string; openBookings: string;
}> = {
  en: {
    title: 'Set up e-invoices', close: 'Close', stepOf: 'Step {current} of {total}', back: 'Back', next: 'Next', done: 'Done',
    loading: 'Checking your details…', loadFailed: 'Could not load your shop details. Please try again later.',
    taxTitle: 'Your tax details', taxBody: 'These are printed on every invoice. The e-invoice cannot be created without a tax number.',
    taxId: 'Steuernummer or USt-IdNr.', taxIdMissing: 'Missing. Please add it, otherwise no invoice can be created.',
    invoiceName: 'Name on the invoice', smallBusiness: 'Kleinunternehmer (§ 19 UStG)', smallBusinessYes: 'Yes, invoices without VAT',
    smallBusinessNo: 'No, VAT is shown on invoices', openInvoiceSettings: 'Open Settings › Invoices',
    addressTitle: 'Your shop address', addressBody: 'The e-invoice needs street, postcode and city separately. We read them from your Store profile.',
    street: 'Street', postcode: 'Postcode', city: 'City', notFound: 'not found',
    addressHint: 'Write your address like this: Musterstraße 1, 12345 Berlin', addressOk: 'All good, your address can be read.',
    openStoreProfile: 'Open Store profile',
    issueTitle: 'Create your first e-invoice', issueBody: 'Invoices are created from a booking, as before:',
    issueSteps: 'Open Bookings|Open the booking|Tap “Invoice (PDF)”|Choose “Private customer” or “Company”|Tap “Create invoice”. The PDF downloads.',
    reprintNote: 'Invoices you created before can be downloaded again at any time, now with the e-invoice inside.',
    openBookings: 'Go to Bookings',
  },
  de: {
    title: 'E-Rechnung einrichten', close: 'Schließen', stepOf: 'Schritt {current} von {total}', back: 'Zurück', next: 'Weiter', done: 'Fertig',
    loading: 'Ihre Angaben werden geprüft…', loadFailed: 'Ihre Geschäftsdaten konnten nicht geladen werden. Bitte später erneut versuchen.',
    taxTitle: 'Ihre Steuerangaben', taxBody: 'Sie stehen auf jeder Rechnung. Ohne Steuernummer kann keine E-Rechnung erstellt werden.',
    taxId: 'Steuernummer oder USt-IdNr.', taxIdMissing: 'Fehlt. Bitte eintragen, sonst kann keine Rechnung erstellt werden.',
    invoiceName: 'Name auf der Rechnung', smallBusiness: 'Kleinunternehmer (§ 19 UStG)', smallBusinessYes: 'Ja, Rechnungen ohne Umsatzsteuer',
    smallBusinessNo: 'Nein, Umsatzsteuer wird ausgewiesen', openInvoiceSettings: 'Einstellungen › Rechnungen öffnen',
    addressTitle: 'Ihre Geschäftsadresse', addressBody: 'Die E-Rechnung braucht Straße, PLZ und Ort einzeln. Wir lesen sie aus Ihrem Geschäftsprofil.',
    street: 'Straße', postcode: 'PLZ', city: 'Ort', notFound: 'nicht gefunden',
    addressHint: 'Schreiben Sie die Adresse so: Musterstraße 1, 12345 Berlin', addressOk: 'Alles gut, Ihre Adresse ist lesbar.',
    openStoreProfile: 'Geschäftsprofil öffnen',
    issueTitle: 'Ihre erste E-Rechnung erstellen', issueBody: 'Rechnungen erstellen Sie wie bisher aus einer Buchung:',
    issueSteps: 'Buchungen öffnen|Die Buchung öffnen|Auf „Rechnung (PDF)“ tippen|„Privatkunde“ oder „Firma“ wählen|„Rechnung erstellen“ tippen. Das PDF wird heruntergeladen.',
    reprintNote: 'Bereits erstellte Rechnungen können Sie jederzeit erneut herunterladen, jetzt mit der E-Rechnung darin.',
    openBookings: 'Zu den Buchungen',
  },
  th: {
    title: 'ตั้งค่าใบแจ้งหนี้อิเล็กทรอนิกส์', close: 'ปิด', stepOf: 'ขั้นตอน {current} จาก {total}', back: 'ย้อนกลับ', next: 'ถัดไป', done: 'เสร็จสิ้น',
    loading: 'กำลังตรวจสอบข้อมูลของคุณ…', loadFailed: 'โหลดข้อมูลร้านไม่สำเร็จ กรุณาลองใหม่ภายหลัง',
    taxTitle: 'ข้อมูลภาษีของคุณ', taxBody: 'ข้อมูลนี้พิมพ์บนใบแจ้งหนี้ทุกใบ หากไม่มีเลขภาษีจะสร้างใบแจ้งหนี้อิเล็กทรอนิกส์ไม่ได้',
    taxId: 'Steuernummer หรือ USt-IdNr.', taxIdMissing: 'ยังไม่มี กรุณากรอก มิฉะนั้นจะสร้างใบแจ้งหนี้ไม่ได้',
    invoiceName: 'ชื่อบนใบแจ้งหนี้', smallBusiness: 'ผู้ประกอบการรายย่อย (§ 19 UStG)', smallBusinessYes: 'ใช่ ใบแจ้งหนี้ไม่มีภาษีมูลค่าเพิ่ม',
    smallBusinessNo: 'ไม่ใช่ แสดงภาษีมูลค่าเพิ่มบนใบแจ้งหนี้', openInvoiceSettings: 'เปิด การตั้งค่า › ใบแจ้งหนี้',
    addressTitle: 'ที่อยู่ร้านของคุณ', addressBody: 'ใบแจ้งหนี้อิเล็กทรอนิกส์ต้องมีถนน รหัสไปรษณีย์ และเมืองแยกกัน เราอ่านจากโปรไฟล์ร้านของคุณ',
    street: 'ถนน', postcode: 'รหัสไปรษณีย์', city: 'เมือง', notFound: 'ไม่พบ',
    addressHint: 'กรอกที่อยู่แบบนี้: Musterstraße 1, 12345 Berlin', addressOk: 'เรียบร้อย อ่านที่อยู่ของคุณได้',
    openStoreProfile: 'เปิดโปรไฟล์ร้าน',
    issueTitle: 'สร้างใบแจ้งหนี้อิเล็กทรอนิกส์ใบแรก', issueBody: 'สร้างใบแจ้งหนี้จากการจองเหมือนเดิม:',
    issueSteps: 'เปิด การจอง|เปิดการจองนั้น|แตะ “ใบแจ้งหนี้ (PDF)”|เลือก “ลูกค้าทั่วไป” หรือ “บริษัท”|แตะ “สร้างใบแจ้งหนี้” แล้ว PDF จะดาวน์โหลด',
    reprintNote: 'ใบแจ้งหนี้ที่สร้างไว้แล้วดาวน์โหลดซ้ำได้ทุกเมื่อ และตอนนี้มีใบแจ้งหนี้อิเล็กทรอนิกส์อยู่ข้างใน',
    openBookings: 'ไปที่การจอง',
  },
};
