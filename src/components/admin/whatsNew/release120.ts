import { Building2, FileCheck2, ReceiptEuro, Scale } from 'lucide-react';
import type { Announcement } from './announcement';

/** Zenno 1.2.0: E-Rechnung (ZUGFeRD) invoices. The last slide opens the invoice setup guide. */
export const RELEASE_120: Announcement = {
  key: 'zenno-release-1.2.0',
  finalActionLabel: { en: 'Set it up now', de: 'Jetzt einrichten', th: 'ตั้งค่าเลย' },
  slides: [
    {
      id: 'welcome',
      icon: ReceiptEuro,
      eyebrow: 'Zenno 1.2.0',
      title: 'Your invoices are now E-Rechnung ready',
      body:
        'From 2027, invoices to companies in Germany must be e-invoices. Zenno now creates them for you automatically. You don’t need any extra software, and it costs nothing extra.',
      points: ['Works for every invoice you create in Zenno', 'Private customers notice nothing different', 'Takes 2 minutes to check your details'],
    },
    {
      id: 'zugferd',
      icon: FileCheck2,
      eyebrow: "What's new · 1 of 3",
      title: 'Every invoice is a ZUGFeRD PDF',
      body:
        'It is a normal PDF that people can read, with the e-invoice data inside for accounting software. One file serves both.',
      points: ['Looks just like your invoices so far', 'Companies import it into their accounting with one click', 'Checked against the official EU rules (EN 16931)'],
    },
    {
      id: 'company',
      icon: Building2,
      eyebrow: "What's new · 2 of 3",
      title: 'Invoices for companies',
      body:
        'When a company pays, for example for a team day or treatments for their staff, choose “Company” in the invoice popup and enter their details once.',
      points: ['Company name and address', 'Their USt-IdNr., if they give you one', 'Their order number, or the Leitweg-ID for public authorities'],
    },
    {
      id: 'rules',
      icon: Scale,
      eyebrow: "What's new · 3 of 3",
      title: 'Who needs an e-invoice?',
      body:
        'Only invoices to companies. For private customers nothing changes. Invoices up to 250 € are also exempt.',
      points: ['From 2027: if your shop’s turnover was over 800,000 €', 'From 2028: for every shop', 'Kleinunternehmer (§ 19 UStG) may send them but don’t have to'],
    },
  ],
  translations: {
    de: {
      welcome: {
        eyebrow: 'Zenno 1.2.0',
        title: 'Ihre Rechnungen sind jetzt E-Rechnung-fähig',
        body: 'Ab 2027 müssen Rechnungen an Firmen in Deutschland E-Rechnungen sein. Zenno erstellt sie jetzt automatisch für Sie. Sie brauchen keine zusätzliche Software, und es kostet nichts extra.',
        points: ['Gilt für jede Rechnung, die Sie in Zenno erstellen', 'Für Privatkunden ändert sich nichts', 'Ihre Angaben prüfen dauert 2 Minuten'],
      },
      zugferd: {
        eyebrow: 'Neu · 1 von 3',
        title: 'Jede Rechnung ist ein ZUGFeRD-PDF',
        body: 'Ein normales PDF zum Lesen, mit den E-Rechnungs-Daten darin für die Buchhaltungssoftware. Eine Datei für beides.',
        points: ['Sieht aus wie Ihre bisherigen Rechnungen', 'Firmen übernehmen sie mit einem Klick in die Buchhaltung', 'Geprüft nach den offiziellen EU-Regeln (EN 16931)'],
      },
      company: {
        eyebrow: 'Neu · 2 von 3',
        title: 'Rechnungen an Firmen',
        body: 'Wenn eine Firma bezahlt, z. B. für einen Teamtag oder Behandlungen für Mitarbeitende, wählen Sie im Rechnungs-Popup „Firma“ und tragen die Angaben einmal ein.',
        points: ['Firmenname und Adresse', 'Die USt-IdNr. der Firma, falls vorhanden', 'Ihre Bestellnummer oder die Leitweg-ID bei Behörden'],
      },
      rules: {
        eyebrow: 'Neu · 3 von 3',
        title: 'Wer braucht eine E-Rechnung?',
        body: 'Nur Rechnungen an Firmen. Für Privatkunden ändert sich nichts. Rechnungen bis 250 € sind ebenfalls ausgenommen.',
        points: ['Ab 2027: wenn Ihr Vorjahresumsatz über 800.000 € lag', 'Ab 2028: für jeden Betrieb', 'Kleinunternehmer (§ 19 UStG) dürfen, müssen aber nicht'],
      },
    },
    th: {
      welcome: {
        eyebrow: 'Zenno 1.2.0',
        title: 'ใบแจ้งหนี้ของคุณพร้อมสำหรับ E-Rechnung แล้ว',
        body: 'ตั้งแต่ปี 2027 ใบแจ้งหนี้ถึงบริษัทในเยอรมนีต้องเป็นใบแจ้งหนี้อิเล็กทรอนิกส์ Zenno สร้างให้คุณโดยอัตโนมัติแล้ว ไม่ต้องใช้ซอฟต์แวร์เพิ่ม และไม่มีค่าใช้จ่ายเพิ่ม',
        points: ['ใช้ได้กับทุกใบแจ้งหนี้ที่สร้างใน Zenno', 'ลูกค้าทั่วไปไม่เห็นความแตกต่าง', 'ตรวจข้อมูลของคุณใช้เวลา 2 นาที'],
      },
      zugferd: {
        eyebrow: 'มีอะไรใหม่ · 1 จาก 3',
        title: 'ใบแจ้งหนี้ทุกใบเป็น PDF แบบ ZUGFeRD',
        body: 'เป็น PDF ปกติที่คนอ่านได้ และมีข้อมูลใบแจ้งหนี้อิเล็กทรอนิกส์อยู่ข้างในสำหรับโปรแกรมบัญชี ไฟล์เดียวใช้ได้ทั้งสองแบบ',
        points: ['หน้าตาเหมือนใบแจ้งหนี้เดิมของคุณ', 'บริษัทนำเข้าระบบบัญชีได้ในคลิกเดียว', 'ตรวจตามกฎของสหภาพยุโรป (EN 16931)'],
      },
      company: {
        eyebrow: 'มีอะไรใหม่ · 2 จาก 3',
        title: 'ใบแจ้งหนี้สำหรับบริษัท',
        body: 'เมื่อบริษัทเป็นผู้จ่าย เช่น วันทีมหรือทรีตเมนต์ให้พนักงาน ให้เลือก “บริษัท” ในหน้าต่างใบแจ้งหนี้ แล้วกรอกข้อมูลครั้งเดียว',
        points: ['ชื่อและที่อยู่บริษัท', 'เลขภาษีมูลค่าเพิ่ม (USt-IdNr.) ของบริษัท ถ้ามี', 'เลขที่ใบสั่งซื้อ หรือ Leitweg-ID สำหรับหน่วยงานรัฐ'],
      },
      rules: {
        eyebrow: 'มีอะไรใหม่ · 3 จาก 3',
        title: 'ใครต้องใช้ใบแจ้งหนี้อิเล็กทรอนิกส์?',
        body: 'เฉพาะใบแจ้งหนี้ถึงบริษัท ลูกค้าทั่วไปไม่มีอะไรเปลี่ยน ใบแจ้งหนี้ไม่เกิน 250 € ก็ได้รับการยกเว้น',
        points: ['ตั้งแต่ 2027: หากรายได้ปีก่อนของร้านคุณเกิน 800,000 €', 'ตั้งแต่ 2028: ทุกร้าน', 'ผู้ประกอบการรายย่อย (§ 19 UStG) ส่งได้แต่ไม่บังคับ'],
      },
    },
  },
};
