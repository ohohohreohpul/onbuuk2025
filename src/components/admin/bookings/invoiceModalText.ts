import type { Translations } from '../../../lib/bookingLanguage';

export const INVOICE_MODAL_TEXT: Translations<{
  title: string; close: string; checking: string; issuedAlready: string; reprintHint: string; download: string;
  whoPays: string; privateCustomer: string; company: string; einvoiceHint: string;
  address: string; addressRequired: string; addressOptional: string; companyName: string; street: string;
  postcode: string; city: string; country: string; vatId: string; reference: string; referenceHelp: string;
  immutable: string; cancel: string; create: string; creating: string;
  missingCompany: string; missingAddress: string; countryInvalid: string; failed: string; loadFailed: string;
}> = {
  en: {
    title: 'Invoice', close: 'Close', checking: 'Checking for an existing invoice…',
    issuedAlready: 'Invoice {number} was issued on {date}.', reprintHint: 'An issued invoice never changes; you can download it again.',
    download: 'Download PDF', whoPays: 'Who gets the invoice?', privateCustomer: 'Private customer', company: 'Company',
    einvoiceHint: 'Every invoice is a ZUGFeRD PDF: a normal PDF with the e-invoice (E-Rechnung) inside. Companies can import it straight into their accounting.',
    address: 'Customer address', addressRequired: 'Needed above 250 €.', addressOptional: 'Optional up to 250 €.',
    companyName: 'Company name', street: 'Street and number', postcode: 'Postcode', city: 'City', country: 'Country',
    vatId: 'Their USt-IdNr. (optional)', reference: 'Their reference (optional)',
    referenceHelp: 'Order number, or Leitweg-ID for public authorities.',
    immutable: 'After creating, the invoice gets its number and can no longer be changed.',
    cancel: 'Cancel', create: 'Create invoice', creating: 'Creating…',
    missingCompany: 'Please fill in company name, street, postcode and city.',
    missingAddress: 'Above 250 € the invoice needs the customer’s address.',
    countryInvalid: 'Country: two letters, e.g. DE or AT.',
    failed: 'Could not create the invoice. Check Settings › Invoices and try again.',
    loadFailed: 'Could not check for an existing invoice. Please try again.',
  },
  de: {
    title: 'Rechnung', close: 'Schließen', checking: 'Prüfe, ob es schon eine Rechnung gibt…',
    issuedAlready: 'Rechnung {number} wurde am {date} ausgestellt.', reprintHint: 'Eine ausgestellte Rechnung ändert sich nie; Sie können sie erneut herunterladen.',
    download: 'PDF herunterladen', whoPays: 'Wer bekommt die Rechnung?', privateCustomer: 'Privatkunde', company: 'Firma',
    einvoiceHint: 'Jede Rechnung ist ein ZUGFeRD-PDF: ein normales PDF mit der E-Rechnung darin. Firmen können sie direkt in ihre Buchhaltung übernehmen.',
    address: 'Adresse des Kunden', addressRequired: 'Über 250 € vorgeschrieben.', addressOptional: 'Bis 250 € freiwillig.',
    companyName: 'Firmenname', street: 'Straße und Hausnummer', postcode: 'PLZ', city: 'Ort', country: 'Land',
    vatId: 'USt-IdNr. der Firma (optional)', reference: 'Referenz der Firma (optional)',
    referenceHelp: 'Bestellnummer, oder Leitweg-ID bei Behörden.',
    immutable: 'Beim Erstellen bekommt die Rechnung ihre Nummer und kann danach nicht mehr geändert werden.',
    cancel: 'Abbrechen', create: 'Rechnung erstellen', creating: 'Wird erstellt…',
    missingCompany: 'Bitte Firmenname, Straße, PLZ und Ort ausfüllen.',
    missingAddress: 'Über 250 € braucht die Rechnung die Adresse des Kunden.',
    countryInvalid: 'Land: zwei Buchstaben, z. B. DE oder AT.',
    failed: 'Die Rechnung konnte nicht erstellt werden. Bitte Einstellungen › Rechnungen prüfen und erneut versuchen.',
    loadFailed: 'Konnte nicht prüfen, ob es schon eine Rechnung gibt. Bitte erneut versuchen.',
  },
  th: {
    title: 'ใบแจ้งหนี้', close: 'ปิด', checking: 'กำลังตรวจสอบว่ามีใบแจ้งหนี้แล้วหรือไม่…',
    issuedAlready: 'ออกใบแจ้งหนี้ {number} แล้วเมื่อ {date}', reprintHint: 'ใบแจ้งหนี้ที่ออกแล้วจะไม่เปลี่ยนแปลง ดาวน์โหลดซ้ำได้',
    download: 'ดาวน์โหลด PDF', whoPays: 'ออกใบแจ้งหนี้ให้ใคร?', privateCustomer: 'ลูกค้าทั่วไป', company: 'บริษัท',
    einvoiceHint: 'ใบแจ้งหนี้ทุกใบเป็น PDF แบบ ZUGFeRD คือ PDF ปกติที่มีใบแจ้งหนี้อิเล็กทรอนิกส์ (E-Rechnung) อยู่ข้างใน บริษัทนำเข้าระบบบัญชีได้ทันที',
    address: 'ที่อยู่ลูกค้า', addressRequired: 'จำเป็นเมื่อเกิน 250 €', addressOptional: 'ไม่บังคับเมื่อไม่เกิน 250 €',
    companyName: 'ชื่อบริษัท', street: 'ถนนและเลขที่', postcode: 'รหัสไปรษณีย์', city: 'เมือง', country: 'ประเทศ',
    vatId: 'เลขภาษีมูลค่าเพิ่มของบริษัท (USt-IdNr.) (ไม่บังคับ)', reference: 'เลขอ้างอิงของบริษัท (ไม่บังคับ)',
    referenceHelp: 'เลขที่ใบสั่งซื้อ หรือ Leitweg-ID สำหรับหน่วยงานรัฐ',
    immutable: 'เมื่อสร้างแล้ว ใบแจ้งหนี้จะได้เลขที่และแก้ไขไม่ได้อีก',
    cancel: 'ยกเลิก', create: 'สร้างใบแจ้งหนี้', creating: 'กำลังสร้าง…',
    missingCompany: 'กรุณากรอกชื่อบริษัท ถนน รหัสไปรษณีย์ และเมือง',
    missingAddress: 'ใบแจ้งหนี้ที่เกิน 250 € ต้องมีที่อยู่ลูกค้า',
    countryInvalid: 'ประเทศ: ตัวอักษร 2 ตัว เช่น DE หรือ AT',
    failed: 'สร้างใบแจ้งหนี้ไม่สำเร็จ กรุณาตรวจสอบ การตั้งค่า › ใบแจ้งหนี้ แล้วลองอีกครั้ง',
    loadFailed: 'ตรวจสอบใบแจ้งหนี้เดิมไม่สำเร็จ กรุณาลองอีกครั้ง',
  },
};
