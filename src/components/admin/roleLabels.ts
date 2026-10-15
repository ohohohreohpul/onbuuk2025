import type { AdminLanguage } from '../../lib/adminLanguage';

/**
 * Translated labels for the built-in roles and permissions. Their English
 * names live in the database (roles / permissions tables); German and Thai
 * are looked up here by role name and permission code.
 */

interface RoleLike {
  name: string;
  display_name: string;
  description: string;
  is_system_role: boolean;
}

interface PermissionLike {
  code: string;
  name: string;
  description: string;
}

type Label = [name: string, description: string];
type ForeignLanguage = Exclude<AdminLanguage, 'en'>;

/** Labels for the built-in system roles, keyed by roles.name. English comes from the database. */
const SYSTEM_ROLE_TEXT: Record<ForeignLanguage, Record<string, Label>> = {
  de: {
    owner: ['Inhaber:in', 'Voller Zugriff auf alle Funktionen'],
    manager: ['Manager:in', 'Verwaltet Buchungen, Team und Leistungen und sieht Berichte'],
    receptionist: ['Empfang', 'Verwaltet Buchungen und Kund:innen'],
    reception: ['Empfang', 'Erstellt und verwaltet Buchungen'],
    cashier: ['Kasse', 'Wickelt Zahlungen ab und sieht Basisinformationen'],
    staff: ['Mitarbeiter:in', 'Sieht den eigenen Kalender und verwaltet die eigene Verfügbarkeit'],
    contractor: ['Freie Mitarbeit', 'Sieht nur eigene Buchungen und Trinkgelder'],
  },
  th: {
    owner: ['เจ้าของร้าน', 'เข้าถึงทุกฟังก์ชันได้เต็มที่'],
    manager: ['ผู้จัดการ', 'จัดการการจอง ทีม และบริการ และดูรายงานได้'],
    receptionist: ['พนักงานต้อนรับ', 'จัดการการจองและลูกค้า'],
    reception: ['พนักงานต้อนรับ', 'สร้างและจัดการการจอง'],
    cashier: ['แคชเชียร์', 'รับชำระเงินและดูข้อมูลพื้นฐาน'],
    staff: ['พนักงาน', 'ดูปฏิทินของตัวเองและจัดการเวลาว่างของตัวเอง'],
    contractor: ['ผู้รับจ้างอิสระ', 'ดูได้เฉพาะการจองและทิปของตัวเอง'],
  },
};

/** Permission labels keyed by permissions.code. English comes from the database. */
const PERMISSION_TEXT: Record<ForeignLanguage, Record<string, Label>> = {
  de: {
    view_own_bookings: ['Eigene Buchungen ansehen', 'Sieht die eigenen zugewiesenen Buchungen'],
    view_all_bookings: ['Alle Buchungen ansehen', 'Sieht alle Buchungen des Betriebs'],
    create_bookings: ['Buchungen erstellen', 'Kann neue Buchungen anlegen'],
    edit_own_bookings: ['Eigene Buchungen bearbeiten', 'Kann eigene Buchungen bearbeiten'],
    edit_all_bookings: ['Alle Buchungen bearbeiten', 'Kann alle Buchungen bearbeiten'],
    delete_bookings: ['Buchungen löschen', 'Kann Buchungen löschen'],
    cancel_bookings: ['Buchungen stornieren', 'Kann Buchungen stornieren'],
    view_own_calendar: ['Eigenen Kalender ansehen', 'Sieht den eigenen Kalender'],
    view_all_calendars: ['Alle Kalender ansehen', 'Sieht die Kalender aller Mitarbeiter:innen'],
    manage_availability: ['Eigene Verfügbarkeit verwalten', 'Verwaltet die eigene Verfügbarkeit'],
    manage_all_availability: ['Alle Verfügbarkeiten verwalten', 'Verwaltet die Verfügbarkeit aller Mitarbeiter:innen'],
    view_customers: ['Kund:innen ansehen', 'Sieht die Kundenliste'],
    edit_customers: ['Kund:innen bearbeiten', 'Kann Kundendaten bearbeiten'],
    view_customer_history: ['Kundenhistorie ansehen', 'Sieht die Buchungshistorie von Kund:innen'],
    add_customer_notes: ['Kundennotizen hinzufügen', 'Kann Notizen zu Kundenprofilen hinzufügen'],
    view_revenue: ['Umsatz ansehen', 'Sieht Umsatzdaten und Berichte'],
    view_own_tips: ['Eigene Trinkgelder ansehen', 'Sieht die eigenen Trinkgelder'],
    view_all_tips: ['Alle Trinkgelder ansehen', 'Sieht die Trinkgelder aller Mitarbeiter:innen'],
    manage_tips: ['Trinkgelder verwalten', 'Verwaltet Aufteilung und Verteilung von Trinkgeldern'],
    process_payments: ['Zahlungen abwickeln', 'Kann Zahlungen an der Kasse abwickeln'],
    issue_refunds: ['Erstattungen ausführen', 'Kann Erstattungen ausführen'],
    view_gift_cards: ['Gutscheine ansehen', 'Sieht Gutscheine'],
    manage_gift_cards: ['Gutscheine verwalten', 'Kann Gutscheine erstellen und verwalten'],
    view_services: ['Leistungen ansehen', 'Sieht Leistungen'],
    manage_services: ['Leistungen verwalten', 'Kann Leistungen anlegen und bearbeiten'],
    view_staff: ['Team ansehen', 'Sieht die Liste der Mitarbeiter:innen'],
    manage_staff: ['Team verwalten', 'Kann Mitarbeiter:innen anlegen und bearbeiten'],
    assign_roles: ['Rollen zuweisen', 'Kann Mitarbeiter:innen Rollen zuweisen'],
    view_settings: ['Einstellungen ansehen', 'Sieht die Betriebseinstellungen'],
    manage_settings: ['Einstellungen verwalten', 'Kann Betriebseinstellungen ändern'],
    manage_business: ['Betrieb verwalten', 'Kann die Stammdaten des Betriebs ändern'],
    view_reports: ['Berichte ansehen', 'Sieht Betriebsberichte'],
    export_reports: ['Berichte exportieren', 'Kann Berichte exportieren'],
  },
  th: {
    view_own_bookings: ['ดูการจองของตัวเอง', 'ดูการจองที่ได้รับมอบหมาย'],
    view_all_bookings: ['ดูการจองทั้งหมด', 'ดูการจองทั้งหมดของธุรกิจ'],
    create_bookings: ['สร้างการจอง', 'สร้างการจองใหม่ได้'],
    edit_own_bookings: ['แก้ไขการจองของตัวเอง', 'แก้ไขการจองของตัวเองได้'],
    edit_all_bookings: ['แก้ไขการจองทั้งหมด', 'แก้ไขการจองทั้งหมดได้'],
    delete_bookings: ['ลบการจอง', 'ลบการจองได้'],
    cancel_bookings: ['ยกเลิกการจอง', 'ยกเลิกการจองได้'],
    view_own_calendar: ['ดูปฏิทินของตัวเอง', 'ดูปฏิทินของตัวเองได้'],
    view_all_calendars: ['ดูปฏิทินทั้งหมด', 'ดูปฏิทินของพนักงานทุกคนได้'],
    manage_availability: ['จัดการเวลาว่างของตัวเอง', 'จัดการเวลาว่างของตัวเองได้'],
    manage_all_availability: ['จัดการเวลาว่างทั้งหมด', 'จัดการเวลาว่างของพนักงานทุกคนได้'],
    view_customers: ['ดูลูกค้า', 'ดูรายชื่อลูกค้าได้'],
    edit_customers: ['แก้ไขลูกค้า', 'แก้ไขข้อมูลลูกค้าได้'],
    view_customer_history: ['ดูประวัติลูกค้า', 'ดูประวัติการจองของลูกค้าได้'],
    add_customer_notes: ['เพิ่มบันทึกลูกค้า', 'เพิ่มบันทึกในโปรไฟล์ลูกค้าได้'],
    view_revenue: ['ดูรายได้', 'ดูข้อมูลรายได้และรายงานได้'],
    view_own_tips: ['ดูทิปของตัวเอง', 'ดูทิปของตัวเองได้'],
    view_all_tips: ['ดูทิปทั้งหมด', 'ดูทิปของพนักงานทุกคนได้'],
    manage_tips: ['จัดการทิป', 'จัดการการแบ่งและแจกจ่ายทิปได้'],
    process_payments: ['รับชำระเงิน', 'รับชำระเงินที่จุดขายได้'],
    issue_refunds: ['คืนเงิน', 'ทำการคืนเงินได้'],
    view_gift_cards: ['ดูบัตรของขวัญ', 'ดูบัตรของขวัญได้'],
    manage_gift_cards: ['จัดการบัตรของขวัญ', 'สร้างและจัดการบัตรของขวัญได้'],
    view_services: ['ดูบริการ', 'ดูบริการได้'],
    manage_services: ['จัดการบริการ', 'สร้างและแก้ไขบริการได้'],
    view_staff: ['ดูพนักงาน', 'ดูรายชื่อพนักงานได้'],
    manage_staff: ['จัดการพนักงาน', 'เพิ่มและแก้ไขพนักงานได้'],
    assign_roles: ['กำหนดบทบาท', 'กำหนดบทบาทให้พนักงานได้'],
    view_settings: ['ดูการตั้งค่า', 'ดูการตั้งค่าธุรกิจได้'],
    manage_settings: ['จัดการการตั้งค่า', 'แก้ไขการตั้งค่าธุรกิจได้'],
    manage_business: ['จัดการธุรกิจ', 'แก้ไขข้อมูลหลักของธุรกิจได้'],
    view_reports: ['ดูรายงาน', 'ดูรายงานธุรกิจได้'],
    export_reports: ['ส่งออกรายงาน', 'ส่งออกรายงานได้'],
  },
};

const CATEGORY_TEXT: Record<ForeignLanguage, Record<string, string>> = {
  de: {
    bookings: 'Buchungen', calendar: 'Kalender', customers: 'Kund:innen', financial: 'Finanzen',
    services: 'Leistungen', staff: 'Team', settings: 'Einstellungen', reports: 'Berichte',
  },
  th: {
    bookings: 'การจอง', calendar: 'ปฏิทิน', customers: 'ลูกค้า', financial: 'การเงิน',
    services: 'บริการ', staff: 'พนักงาน', settings: 'การตั้งค่า', reports: 'รายงาน',
  },
};

export const roleLabel = (role: RoleLike, lang: AdminLanguage): Label => {
  const fallback: Label = [role.display_name, role.description];
  if (lang === 'en' || !role.is_system_role) return fallback;
  return SYSTEM_ROLE_TEXT[lang][role.name] ?? fallback;
};

export const permissionLabel = (perm: PermissionLike, lang: AdminLanguage): Label => {
  const fallback: Label = [perm.name, perm.description];
  if (lang === 'en') return fallback;
  return PERMISSION_TEXT[lang][perm.code] ?? fallback;
};

export const categoryLabel = (category: string, lang: AdminLanguage): string =>
  lang === 'en' ? category : CATEGORY_TEXT[lang][category] ?? category;
