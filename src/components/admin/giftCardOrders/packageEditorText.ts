import type { Translations } from '../../../lib/bookingLanguage';

type Keys =
  | 'newTitle' | 'editTitle' | 'close' | 'cancel' | 'save' | 'saving' | 'loadFailed' | 'saveFailed'
  | 'name' | 'namePlaceholder' | 'subtitle' | 'subtitlePlaceholder' | 'description' | 'price' | 'comparePrice' | 'comparePriceHint'
  | 'contents' | 'contentsHint' | 'addItem' | 'removeItem' | 'kindPass' | 'kindValue' | 'treatment' | 'chooseTreatment' | 'duration'
  | 'visits' | 'amount' | 'count' | 'gift' | 'giftPlaceholder' | 'from' | 'until' | 'stock' | 'stockHint' | 'onSale'
  | 'needName' | 'needPrice' | 'needItems' | 'badItem' | 'badDates' | 'worth' | 'newSet' | 'edit' | 'noSets';

export const PACKAGE_EDITOR_TEXT: Translations<Record<Keys, string>> = {
  en: {
    newTitle: 'New voucher set', editTitle: 'Edit voucher set', close: 'Close', cancel: 'Cancel', save: 'Save set', saving: 'Saving…',
    loadFailed: 'Could not load the set.', saveFailed: 'Could not save. Please try again.',
    name: 'Name', namePlaceholder: 'e.g. Christmas set', subtitle: 'Short line (optional)', subtitlePlaceholder: 'e.g. 3 × Thai massage 60 min',
    description: 'Description (optional)', price: 'Price (€)', comparePrice: 'Regular price (€, optional)', comparePriceHint: 'Shown crossed out next to the price.',
    contents: 'What is in the set', contentsHint: 'Each line becomes vouchers the buyer receives.', addItem: 'Add item', removeItem: 'Remove',
    kindPass: 'Treatment visits', kindValue: 'Value voucher', treatment: 'Treatment', chooseTreatment: 'Choose a treatment', duration: 'Duration',
    visits: 'Visits', amount: 'Value (€)', count: 'Number of vouchers', gift: 'Gift with the set (optional)', giftPlaceholder: 'e.g. a free aroma oil',
    from: 'On sale from (optional)', until: 'On sale until (optional)', stock: 'Sets available (optional)', stockHint: 'Empty = no limit.', onSale: 'On sale',
    needName: 'Please give the set a name.', needPrice: 'Please enter a price.', needItems: 'Add at least one item.',
    badItem: 'Every item needs a treatment and duration, or a value.', badDates: '"Until" must be after "from".', worth: 'Worth {amount}',
    newSet: 'New set', edit: 'Edit', noSets: 'No voucher sets yet. Create one to sell it online and at the counter.',
  },
  de: {
    newTitle: 'Neues Gutschein-Paket', editTitle: 'Gutschein-Paket bearbeiten', close: 'Schließen', cancel: 'Abbrechen', save: 'Paket speichern', saving: 'Wird gespeichert…',
    loadFailed: 'Das Paket konnte nicht geladen werden.', saveFailed: 'Speichern fehlgeschlagen. Bitte erneut versuchen.',
    name: 'Name', namePlaceholder: 'z. B. Weihnachts-Paket', subtitle: 'Kurze Zeile (optional)', subtitlePlaceholder: 'z. B. 3 × Thai-Massage 60 Min.',
    description: 'Beschreibung (optional)', price: 'Preis (€)', comparePrice: 'Normalpreis (€, optional)', comparePriceHint: 'Wird durchgestrichen neben dem Preis gezeigt.',
    contents: 'Was im Paket ist', contentsHint: 'Jede Zeile wird zu Gutscheinen für die Käufer:in.', addItem: 'Position hinzufügen', removeItem: 'Entfernen',
    kindPass: 'Behandlungs-Besuche', kindValue: 'Wertgutschein', treatment: 'Behandlung', chooseTreatment: 'Behandlung wählen', duration: 'Dauer',
    visits: 'Besuche', amount: 'Wert (€)', count: 'Anzahl Gutscheine', gift: 'Geschenk zum Paket (optional)', giftPlaceholder: 'z. B. ein Aromaöl gratis',
    from: 'Im Verkauf ab (optional)', until: 'Im Verkauf bis (optional)', stock: 'Verfügbare Pakete (optional)', stockHint: 'Leer = unbegrenzt.', onSale: 'Im Verkauf',
    needName: 'Bitte geben Sie dem Paket einen Namen.', needPrice: 'Bitte einen Preis eingeben.', needItems: 'Mindestens eine Position hinzufügen.',
    badItem: 'Jede Position braucht Behandlung und Dauer oder einen Wert.', badDates: '„Bis“ muss nach „ab“ liegen.', worth: 'Wert {amount}',
    newSet: 'Neues Paket', edit: 'Bearbeiten', noSets: 'Noch keine Gutschein-Pakete. Legen Sie eins an, um es online und an der Theke zu verkaufen.',
  },
  th: {
    newTitle: 'แพ็กเกจบัตรของขวัญใหม่', editTitle: 'แก้ไขแพ็กเกจบัตรของขวัญ', close: 'ปิด', cancel: 'ยกเลิก', save: 'บันทึกแพ็กเกจ', saving: 'กำลังบันทึก…',
    loadFailed: 'โหลดแพ็กเกจไม่สำเร็จ', saveFailed: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง',
    name: 'ชื่อ', namePlaceholder: 'เช่น แพ็กเกจคริสต์มาส', subtitle: 'คำอธิบายสั้น (ไม่บังคับ)', subtitlePlaceholder: 'เช่น นวดไทย 60 นาที × 3',
    description: 'รายละเอียด (ไม่บังคับ)', price: 'ราคา (€)', comparePrice: 'ราคาปกติ (€, ไม่บังคับ)', comparePriceHint: 'แสดงเป็นราคาขีดฆ่าข้างราคาขาย',
    contents: 'สิ่งที่อยู่ในแพ็กเกจ', contentsHint: 'แต่ละบรรทัดจะกลายเป็นบัตรที่ผู้ซื้อได้รับ', addItem: 'เพิ่มรายการ', removeItem: 'ลบ',
    kindPass: 'จำนวนครั้งของบริการ', kindValue: 'บัตรมูลค่า', treatment: 'บริการ', chooseTreatment: 'เลือกบริการ', duration: 'ระยะเวลา',
    visits: 'จำนวนครั้ง', amount: 'มูลค่า (€)', count: 'จำนวนบัตร', gift: 'ของแถม (ไม่บังคับ)', giftPlaceholder: 'เช่น น้ำมันหอมระเหยฟรี',
    from: 'เริ่มขาย (ไม่บังคับ)', until: 'ขายถึง (ไม่บังคับ)', stock: 'จำนวนแพ็กเกจที่ขายได้ (ไม่บังคับ)', stockHint: 'เว้นว่าง = ไม่จำกัด', onSale: 'วางขาย',
    needName: 'กรุณาตั้งชื่อแพ็กเกจ', needPrice: 'กรุณาใส่ราคา', needItems: 'เพิ่มอย่างน้อยหนึ่งรายการ',
    badItem: 'ทุกรายการต้องมีบริการและระยะเวลา หรือมูลค่า', badDates: '"ขายถึง" ต้องอยู่หลัง "เริ่มขาย"', worth: 'มูลค่า {amount}',
    newSet: 'แพ็กเกจใหม่', edit: 'แก้ไข', noSets: 'ยังไม่มีแพ็กเกจบัตรของขวัญ สร้างเพื่อขายออนไลน์และที่ร้าน',
  },
};

export type PackageEditorText = (typeof PACKAGE_EDITOR_TEXT)['en'];
