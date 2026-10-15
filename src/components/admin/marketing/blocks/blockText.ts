import type { Translations } from '../../../../lib/bookingLanguage';

export const BLOCK_TEXT: Translations<{
  hero: string; heading: string; text: string; image: string; button: string; offer: string; vouchers: string; divider: string;
  heroHint: string; headingHint: string; textHint: string; imageHint: string; buttonHint: string; offerHint: string; vouchersHint: string; dividerHint: string;
  addBlock: string; moveUp: string; moveDown: string; remove: string;
  logo: string; photo: string; optional: string; headline: string; headlineHint: string; caption: string; buttonText: string; buttonUrl: string;
  body: string; bodyHint: string; chooseImage: string; changeImage: string; removeImage: string; size: string; small: string; medium: string; full: string;
  link: string; style: string; dark: string; light: string; title: string; price: string; comparePrice: string; showImages: string;
  vouchersTitle: string; vouchersAuto: string;
}> = {
  en: {
    hero: 'Header', heading: 'Heading', text: 'Text', image: 'Image', button: 'Button', offer: 'Offer of the month', vouchers: 'Gift cards', divider: 'Divider',
    heroHint: 'Logo, photo, headline', headingHint: 'Large title', textHint: 'Paragraphs', imageHint: 'Logo, gift card, photo…',
    buttonHint: 'Link to your shop', offerHint: 'Title, price, button', vouchersHint: 'Your cards, filled in automatically', dividerHint: 'Thin line',
    addBlock: 'Add block', moveUp: 'Move up', moveDown: 'Move down', remove: 'Remove block',
    logo: 'Logo', photo: 'Photo', optional: 'optional', headline: 'Headline',
    headlineHint: 'Second line appears softer.', caption: 'Small line under the button', buttonText: 'Button text', buttonUrl: 'Button link (https://…)',
    body: 'Text', bodyHint: 'Blank line = new paragraph. {vorname} = first name.', chooseImage: 'Choose image', changeImage: 'Change', removeImage: 'Remove',
    size: 'Size', small: 'Small', medium: 'Medium', full: 'Full width', link: 'Link when clicked (optional)', style: 'Style', dark: 'Dark', light: 'Light',
    title: 'Title', price: 'Price (€)', comparePrice: 'Instead of (€)', showImages: 'Show photos of the treatments',
    vouchersTitle: 'Title (optional)', vouchersAuto: 'Shows up to 4 of your active gift card sets and multi-visit cards, with price and a buy link.',
  },
  de: {
    hero: 'Kopfbereich', heading: 'Überschrift', text: 'Text', image: 'Bild', button: 'Button', offer: 'Angebot des Monats', vouchers: 'Gutscheine', divider: 'Trennlinie',
    heroHint: 'Logo, Foto, Überschrift', headingHint: 'Großer Titel', textHint: 'Absätze', imageHint: 'Logo, Gutschein, Foto…',
    buttonHint: 'Link zu Ihrem Shop', offerHint: 'Titel, Preis, Button', vouchersHint: 'Ihre Karten, automatisch eingefügt', dividerHint: 'Dünne Linie',
    addBlock: 'Block hinzufügen', moveUp: 'Nach oben', moveDown: 'Nach unten', remove: 'Block entfernen',
    logo: 'Logo', photo: 'Foto', optional: 'optional', headline: 'Überschrift',
    headlineHint: 'Die zweite Zeile erscheint heller.', caption: 'Kleine Zeile unter dem Button', buttonText: 'Button-Text', buttonUrl: 'Button-Link (https://…)',
    body: 'Text', bodyHint: 'Leerzeile = neuer Absatz. {vorname} = Vorname.', chooseImage: 'Bild wählen', changeImage: 'Ändern', removeImage: 'Entfernen',
    size: 'Größe', small: 'Klein', medium: 'Mittel', full: 'Volle Breite', link: 'Link beim Klick (optional)', style: 'Stil', dark: 'Dunkel', light: 'Hell',
    title: 'Titel', price: 'Preis (€)', comparePrice: 'Statt (€)', showImages: 'Fotos der Behandlungen zeigen',
    vouchersTitle: 'Titel (optional)', vouchersAuto: 'Zeigt bis zu 4 Ihrer aktiven Gutscheinsets und Behandlungsgutscheine mit Preis und Kauf-Link.',
  },
  th: {
    hero: 'ส่วนหัว', heading: 'หัวข้อ', text: 'ข้อความ', image: 'รูปภาพ', button: 'ปุ่ม', offer: 'โปรโมชันประจำเดือน', vouchers: 'บัตรของขวัญ', divider: 'เส้นคั่น',
    heroHint: 'โลโก้ หัวข้อ รูปพื้นหลัง (ไม่บังคับ)', headingHint: 'หัวข้อใหญ่', textHint: 'ย่อหน้า', imageHint: 'โลโก้ บัตรของขวัญ รูปภาพ…',
    buttonHint: 'ลิงก์ไปยังร้าน', offerHint: 'ชื่อ ราคา ปุ่ม', vouchersHint: 'บัตรของร้าน ใส่ให้อัตโนมัติ', dividerHint: 'เส้นบาง',
    addBlock: 'เพิ่มบล็อก', moveUp: 'เลื่อนขึ้น', moveDown: 'เลื่อนลง', remove: 'ลบบล็อก',
    logo: 'โลโก้', photo: 'รูปภาพ', optional: 'ไม่บังคับ', headline: 'หัวข้อ',
    headlineHint: 'บรรทัดที่สองจะเป็นสีอ่อนกว่า', caption: 'ข้อความเล็กใต้ปุ่ม', buttonText: 'ข้อความบนปุ่ม', buttonUrl: 'ลิงก์ของปุ่ม (https://…)',
    body: 'ข้อความ', bodyHint: 'เว้นบรรทัด = ย่อหน้าใหม่  {vorname} = ชื่อลูกค้า', chooseImage: 'เลือกรูป', changeImage: 'เปลี่ยน', removeImage: 'ลบ',
    size: 'ขนาด', small: 'เล็ก', medium: 'กลาง', full: 'เต็มความกว้าง', link: 'ลิงก์เมื่อคลิก (ไม่บังคับ)', style: 'สไตล์', dark: 'เข้ม', light: 'อ่อน',
    title: 'ชื่อ', price: 'ราคา (€)', comparePrice: 'จากปกติ (€)', showImages: 'แสดงรูปของบริการ',
    vouchersTitle: 'หัวข้อ (ไม่บังคับ)', vouchersAuto: 'แสดงชุดบัตรของขวัญและบัตรบริการที่เปิดขายอยู่ สูงสุด 4 รายการ พร้อมราคาและลิงก์ซื้อ',
  },
};
