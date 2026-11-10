import type { Translations } from '../../../lib/bookingLanguage';

type Keys =
  | 'title' | 'subtitle' | 'loadFailed' | 'planTitle' | 'planBody' | 'planButton'
  | 'accounts' | 'accountsHint' | 'connectInstagram' | 'connectFacebook' | 'connecting' | 'noAccounts'
  | 'connected' | 'inactive' | 'disconnect' | 'confirmDisconnect' | 'connectedNotice'
  | 'dmTitle' | 'dmBody' | 'openInbox'
  | 'automations' | 'automationsHint' | 'newAutomation' | 'noAutomations' | 'on' | 'off' | 'edit' | 'sentCount'
  | 'name' | 'namePlaceholder' | 'account' | 'keywords' | 'keywordsHint' | 'dmMessage' | 'dmPlaceholder'
  | 'buttonTitle' | 'buttonUrl' | 'buttonHint' | 'commentReply' | 'commentReplyHint' | 'active'
  | 'save' | 'saving' | 'cancel' | 'delete' | 'confirmDelete' | 'needAccount'
  | 'defaultName' | 'defaultKeywords' | 'defaultDm' | 'defaultButton' | 'defaultReply';

export const SOCIAL_TEXT: Translations<Record<Keys, string>> = {
  en: {
    title: 'Instagram & Facebook', subtitle: 'Your AI receptionist answers direct messages and sends the booking link to people who comment.',
    loadFailed: 'Could not load Instagram & Facebook.', planTitle: 'Part of Zenno Social',
    planBody: 'With Zenno Social (69 € / month) your AI receptionist also answers Instagram and Facebook messages, and a keyword in the comments sends the booking link.',
    planButton: 'See plans',
    accounts: 'Connected accounts', accountsHint: 'You log in with Instagram or Facebook directly. Zenno never sees your password.',
    connectInstagram: 'Connect Instagram', connectFacebook: 'Connect Facebook', connecting: 'Opening…',
    noAccounts: 'No account connected yet.', connected: 'Connected', inactive: 'Disconnected',
    disconnect: 'Disconnect', confirmDisconnect: 'Disconnect this account? Messages from it will no longer reach Zenno.',
    connectedNotice: 'Account connected.',
    dmTitle: 'Direct messages', dmBody: 'Messages land in the inbox of your AI receptionist, next to WhatsApp, email and the website chat.', openInbox: 'Open inbox',
    automations: 'Comment-to-DM', automationsHint: 'Someone comments a keyword under your post, they get a private message with your booking link.',
    newAutomation: 'New automation', noAutomations: 'No automation yet.', on: 'On', off: 'Off', edit: 'Edit', sentCount: '{count} messages sent',
    name: 'Name', namePlaceholder: 'e.g. Book via comment', account: 'Account', keywords: 'Keywords',
    keywordsHint: 'Separate with commas. Whole words, small typos are fine.', dmMessage: 'Private message', dmPlaceholder: 'Hi! Here is the link to book…',
    buttonTitle: 'Button label', buttonUrl: 'Button link', buttonHint: 'Optional. Max. 20 characters.',
    commentReply: 'Public reply (optional)', commentReplyHint: 'Shown under the comment, e.g. "Sent you a message!"', active: 'Active',
    save: 'Save', saving: 'Saving…', cancel: 'Cancel', delete: 'Delete', confirmDelete: 'Delete this automation?',
    needAccount: 'Connect Instagram or Facebook first.',
    defaultName: 'Book via comment', defaultKeywords: 'book, appointment', defaultDm: 'Hi! Thanks for your comment. Here you can book your appointment in a few clicks:',
    defaultButton: 'Book now', defaultReply: 'We sent you a message!',
  },
  de: {
    title: 'Instagram & Facebook', subtitle: 'Ihre KI-Rezeption beantwortet Direktnachrichten und schickt Kommentierenden den Buchungslink.',
    loadFailed: 'Instagram & Facebook konnte nicht geladen werden.', planTitle: 'Teil von Zenno Social',
    planBody: 'Mit Zenno Social (69 € / Monat) beantwortet Ihre KI-Rezeption auch Instagram- und Facebook-Nachrichten, und ein Stichwort im Kommentar schickt den Buchungslink.',
    planButton: 'Tarife ansehen',
    accounts: 'Verbundene Konten', accountsHint: 'Sie melden sich direkt bei Instagram oder Facebook an. Zenno sieht Ihr Passwort nie.',
    connectInstagram: 'Instagram verbinden', connectFacebook: 'Facebook verbinden', connecting: 'Wird geöffnet…',
    noAccounts: 'Noch kein Konto verbunden.', connected: 'Verbunden', inactive: 'Getrennt',
    disconnect: 'Trennen', confirmDisconnect: 'Dieses Konto trennen? Nachrichten daraus kommen dann nicht mehr bei Zenno an.',
    connectedNotice: 'Konto verbunden.',
    dmTitle: 'Direktnachrichten', dmBody: 'Nachrichten landen im Posteingang Ihrer KI-Rezeption, neben WhatsApp, E-Mail und dem Website-Chat.', openInbox: 'Posteingang öffnen',
    automations: 'Kommentar-zu-DM', automationsHint: 'Jemand kommentiert ein Stichwort unter Ihrem Beitrag und bekommt eine private Nachricht mit Ihrem Buchungslink.',
    newAutomation: 'Neue Automation', noAutomations: 'Noch keine Automation.', on: 'An', off: 'Aus', edit: 'Bearbeiten', sentCount: '{count} Nachrichten gesendet',
    name: 'Name', namePlaceholder: 'z. B. Buchen per Kommentar', account: 'Konto', keywords: 'Stichwörter',
    keywordsHint: 'Mit Komma trennen. Ganze Wörter, kleine Tippfehler sind okay.', dmMessage: 'Private Nachricht', dmPlaceholder: 'Hallo! Hier ist der Link zum Buchen…',
    buttonTitle: 'Button-Text', buttonUrl: 'Button-Link', buttonHint: 'Optional. Max. 20 Zeichen.',
    commentReply: 'Öffentliche Antwort (optional)', commentReplyHint: 'Erscheint unter dem Kommentar, z. B. „Wir haben dir geschrieben!“', active: 'Aktiv',
    save: 'Speichern', saving: 'Wird gespeichert…', cancel: 'Abbrechen', delete: 'Löschen', confirmDelete: 'Diese Automation löschen?',
    needAccount: 'Bitte zuerst Instagram oder Facebook verbinden.',
    defaultName: 'Buchen per Kommentar', defaultKeywords: 'buchen, termin', defaultDm: 'Hallo! Danke für deinen Kommentar. Hier kannst du deinen Termin in wenigen Klicks buchen:',
    defaultButton: 'Jetzt buchen', defaultReply: 'Wir haben dir geschrieben!',
  },
  th: {
    title: 'Instagram และ Facebook', subtitle: 'พนักงานต้อนรับ AI ตอบข้อความส่วนตัว และส่งลิงก์จองให้คนที่คอมเมนต์',
    loadFailed: 'โหลด Instagram และ Facebook ไม่สำเร็จ', planTitle: 'อยู่ในแพ็กเกจ Zenno Social',
    planBody: 'กับ Zenno Social (69 € / เดือน) พนักงานต้อนรับ AI จะตอบข้อความ Instagram และ Facebook ด้วย และคำสำคัญในคอมเมนต์จะส่งลิงก์จองให้ทันที',
    planButton: 'ดูแพ็กเกจ',
    accounts: 'บัญชีที่เชื่อมต่อ', accountsHint: 'คุณเข้าสู่ระบบกับ Instagram หรือ Facebook โดยตรง Zenno ไม่เห็นรหัสผ่านของคุณ',
    connectInstagram: 'เชื่อมต่อ Instagram', connectFacebook: 'เชื่อมต่อ Facebook', connecting: 'กำลังเปิด…',
    noAccounts: 'ยังไม่ได้เชื่อมต่อบัญชี', connected: 'เชื่อมต่อแล้ว', inactive: 'ยกเลิกการเชื่อมต่อแล้ว',
    disconnect: 'ยกเลิกการเชื่อมต่อ', confirmDisconnect: 'ยกเลิกการเชื่อมต่อบัญชีนี้? ข้อความจากบัญชีนี้จะไม่เข้ามาที่ Zenno อีก',
    connectedNotice: 'เชื่อมต่อบัญชีแล้ว',
    dmTitle: 'ข้อความส่วนตัว', dmBody: 'ข้อความจะเข้ามาในกล่องข้อความของพนักงานต้อนรับ AI ร่วมกับ WhatsApp อีเมล และแชทบนเว็บไซต์', openInbox: 'เปิดกล่องข้อความ',
    automations: 'คอมเมนต์เป็น DM', automationsHint: 'เมื่อมีคนคอมเมนต์คำสำคัญใต้โพสต์ ระบบจะส่งข้อความส่วนตัวพร้อมลิงก์จองให้',
    newAutomation: 'สร้างระบบอัตโนมัติ', noAutomations: 'ยังไม่มีระบบอัตโนมัติ', on: 'เปิด', off: 'ปิด', edit: 'แก้ไข', sentCount: 'ส่งแล้ว {count} ข้อความ',
    name: 'ชื่อ', namePlaceholder: 'เช่น จองผ่านคอมเมนต์', account: 'บัญชี', keywords: 'คำสำคัญ',
    keywordsHint: 'คั่นด้วยเครื่องหมายจุลภาค ใช้ทั้งคำ พิมพ์ผิดเล็กน้อยได้', dmMessage: 'ข้อความส่วนตัว', dmPlaceholder: 'สวัสดีค่ะ นี่คือลิงก์สำหรับจอง…',
    buttonTitle: 'ข้อความบนปุ่ม', buttonUrl: 'ลิงก์ของปุ่ม', buttonHint: 'ไม่บังคับ ไม่เกิน 20 ตัวอักษร',
    commentReply: 'ตอบกลับสาธารณะ (ไม่บังคับ)', commentReplyHint: 'แสดงใต้คอมเมนต์ เช่น "ส่งข้อความไปแล้วนะคะ!"', active: 'เปิดใช้งาน',
    save: 'บันทึก', saving: 'กำลังบันทึก…', cancel: 'ยกเลิก', delete: 'ลบ', confirmDelete: 'ลบระบบอัตโนมัตินี้?',
    needAccount: 'กรุณาเชื่อมต่อ Instagram หรือ Facebook ก่อน',
    defaultName: 'Buchen per Kommentar', defaultKeywords: 'buchen, termin', defaultDm: 'Hallo! Danke für deinen Kommentar. Hier kannst du deinen Termin in wenigen Klicks buchen:',
    defaultButton: 'Jetzt buchen', defaultReply: 'Wir haben dir geschrieben!',
  },
};
