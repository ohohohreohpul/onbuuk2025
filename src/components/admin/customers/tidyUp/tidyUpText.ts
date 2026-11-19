import type { Translations } from '../../../../lib/bookingLanguage';

export const TIDY_UP_TEXT: Translations<{
  allCustomers: string; tidyUp: string; intro: string; empty: string; review: string;
  sameEmail: string; samePhone: string; sameName: string; likely: string; check: string; customersCount: string;
  title: string; close: string; reviewIntro: string; include: string; visitOne: string; visits: string; blocked: string;
  keepName: string; keepEmail: string; keepPhone: string; noPhone: string; mergeNote: string;
  notSame: string; merge: string; merging: string; chooseTwo: string; failed: string; dismissFailed: string; loginConflict: string;
}> = {
  en: {
    allCustomers: 'All customers', tidyUp: 'Tidy up ({count})',
    intro: 'These customers look like the same person. Review each group and merge them, or mark them as different people.',
    empty: 'All tidy. No possible duplicates found.', review: 'Review',
    sameEmail: 'Same email', samePhone: 'Same phone', sameName: 'Same name',
    likely: 'Very likely', check: 'Please check', customersCount: '{count} customers',
    title: 'Same person?', close: 'Close',
    reviewIntro: 'Untick anyone who is a different person. Then choose what the merged customer keeps.',
    include: 'Include', visitOne: '1 visit', visits: '{count} visits', blocked: 'Blocked',
    keepName: 'Name', keepEmail: 'Main email', keepPhone: 'Phone', noPhone: 'No phone',
    mergeNote: 'Notes, loyalty points, vouchers and history move to one customer. The other emails still find this customer. Old bookings are not changed. This cannot be undone.',
    notSame: 'Not the same person', merge: 'Merge {count} customers', merging: 'Merging…',
    chooseTwo: 'Tick at least two customers to merge.', failed: 'Could not merge. Please try again.',
    dismissFailed: 'Could not save. Please try again.', loginConflict: 'Two of these customers have their own login, so they cannot be merged.',
  },
  de: {
    allCustomers: 'Alle Kunden', tidyUp: 'Aufräumen ({count})',
    intro: 'Diese Kunden sehen nach derselben Person aus. Prüfen Sie jede Gruppe und führen Sie sie zusammen oder markieren Sie sie als verschiedene Personen.',
    empty: 'Alles aufgeräumt. Keine möglichen Dubletten gefunden.', review: 'Prüfen',
    sameEmail: 'Gleiche E-Mail', samePhone: 'Gleiche Telefonnummer', sameName: 'Gleicher Name',
    likely: 'Sehr wahrscheinlich', check: 'Bitte prüfen', customersCount: '{count} Kunden',
    title: 'Dieselbe Person?', close: 'Schließen',
    reviewIntro: 'Entfernen Sie den Haken bei allen, die eine andere Person sind. Dann wählen Sie, was der zusammengeführte Kunde behält.',
    include: 'Dabei', visitOne: '1 Besuch', visits: '{count} Besuche', blocked: 'Gesperrt',
    keepName: 'Name', keepEmail: 'Haupt-E-Mail', keepPhone: 'Telefon', noPhone: 'Keine Telefonnummer',
    mergeNote: 'Notizen, Treuepunkte, Gutscheine und Verlauf wandern zu einem Kunden. Die anderen E-Mails finden diesen Kunden weiterhin. Alte Buchungen bleiben unverändert. Das kann nicht rückgängig gemacht werden.',
    notSame: 'Nicht dieselbe Person', merge: '{count} Kunden zusammenführen', merging: 'Wird zusammengeführt…',
    chooseTwo: 'Bitte mindestens zwei Kunden zum Zusammenführen anhaken.', failed: 'Zusammenführen fehlgeschlagen. Bitte erneut versuchen.',
    dismissFailed: 'Speichern fehlgeschlagen. Bitte erneut versuchen.', loginConflict: 'Zwei dieser Kunden haben ein eigenes Login und können nicht zusammengeführt werden.',
  },
  th: {
    allCustomers: 'ลูกค้าทั้งหมด', tidyUp: 'จัดระเบียบ ({count})',
    intro: 'ลูกค้าเหล่านี้ดูเหมือนเป็นคนเดียวกัน ตรวจสอบแต่ละกลุ่มแล้วรวมเข้าด้วยกัน หรือระบุว่าเป็นคนละคน',
    empty: 'เรียบร้อย ไม่พบข้อมูลลูกค้าซ้ำ', review: 'ตรวจสอบ',
    sameEmail: 'อีเมลเดียวกัน', samePhone: 'เบอร์โทรเดียวกัน', sameName: 'ชื่อเดียวกัน',
    likely: 'น่าจะใช่', check: 'กรุณาตรวจสอบ', customersCount: 'ลูกค้า {count} ราย',
    title: 'เป็นคนเดียวกันไหม?', close: 'ปิด',
    reviewIntro: 'เอาเครื่องหมายออกจากคนที่เป็นคนละคน แล้วเลือกข้อมูลที่ลูกค้าที่รวมแล้วจะเก็บไว้',
    include: 'รวม', visitOne: 'มาใช้บริการ 1 ครั้ง', visits: 'มาใช้บริการ {count} ครั้ง', blocked: 'ถูกระงับ',
    keepName: 'ชื่อ', keepEmail: 'อีเมลหลัก', keepPhone: 'เบอร์โทร', noPhone: 'ไม่มีเบอร์โทร',
    mergeNote: 'บันทึก แต้มสะสม บัตรของขวัญ และประวัติจะย้ายไปอยู่ที่ลูกค้าคนเดียว อีเมลอื่นยังค้นหาลูกค้านี้ได้ การจองเก่าไม่เปลี่ยนแปลง และย้อนกลับไม่ได้',
    notSame: 'ไม่ใช่คนเดียวกัน', merge: 'รวมลูกค้า {count} ราย', merging: 'กำลังรวม…',
    chooseTwo: 'กรุณาเลือกลูกค้าอย่างน้อยสองรายเพื่อรวม', failed: 'รวมไม่สำเร็จ กรุณาลองอีกครั้ง',
    dismissFailed: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง', loginConflict: 'ลูกค้าสองรายนี้มีบัญชีเข้าสู่ระบบของตัวเอง จึงรวมกันไม่ได้',
  },
};
