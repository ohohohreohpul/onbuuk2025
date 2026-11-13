import type { Translations } from '../../../lib/bookingLanguage';

type Keys =
  | 'googleTitle' | 'googleHint' | 'connectGoogle' | 'notConnected' | 'openReviewLink' | 'openMaps' | 'settings'
  | 'reviewsTitle' | 'reviewsHint' | 'refresh' | 'refreshing' | 'noReviews' | 'noText'
  | 'statusOpen' | 'statusDraft' | 'statusReplied' | 'statusAuto' | 'statusFailed' | 'reply' | 'view'
  | 'reviewTitle' | 'yourReply' | 'replyPlaceholder' | 'draftWithAi' | 'drafting' | 'aiCost' | 'publishReply' | 'publishing'
  | 'replyPublished' | 'replyOverwrite'
  | 'postsTitle' | 'postsHint' | 'draftPost' | 'newPost' | 'noPosts' | 'lastPostDays' | 'noPostYet'
  | 'postStatusDraft' | 'postStatusScheduled' | 'postStatusPublished' | 'postStatusFaded' | 'postStatusFailed' | 'edit'
  | 'postTitle' | 'postText' | 'postTextHint' | 'button' | 'noButton' | 'buttonLink' | 'when' | 'whenHint'
  | 'saveDraft' | 'schedule' | 'publishNow' | 'saving' | 'deletePost' | 'cancelPost' | 'confirmDelete' | 'publishedReadOnly'
  | 'ctaBOOK' | 'ctaLEARN_MORE' | 'ctaORDER' | 'ctaSHOP' | 'ctaSIGN_UP' | 'ctaCALL'
  | 'settingsTitle' | 'autoReply' | 'autoReplyHint' | 'syncHours' | 'syncServices' | 'syncHint' | 'syncNow' | 'syncing'
  | 'lastSynced' | 'syncPending' | 'syncError' | 'save' | 'close' | 'cancel' | 'chars';

export const LOCAL_SEO_TEXT: Translations<Record<Keys, string>> = {
  en: {
    googleTitle: 'Google Business Profile', googleHint: 'Answer reviews, post weekly updates and keep your hours and services up to date on Google Search and Maps.',
    connectGoogle: 'Connect Google', notConnected: 'Connect your Google Business Profile to see reviews and publish posts.',
    openReviewLink: 'Review link', openMaps: 'On Google Maps', settings: 'Settings',
    reviewsTitle: 'Google reviews', reviewsHint: 'AI drafts a reply in your voice; you check it and publish.', refresh: 'Refresh', refreshing: 'Loading…',
    noReviews: 'No reviews yet.', noText: 'Stars only, no text.',
    statusOpen: 'Open', statusDraft: 'Draft ready', statusReplied: 'Answered', statusAuto: 'Answered by AI', statusFailed: 'Not sent', reply: 'Reply', view: 'View',
    reviewTitle: 'Review from {name}', yourReply: 'Your reply', replyPlaceholder: 'Thank you for your review…',
    draftWithAi: 'Draft with AI', drafting: 'Drafting…', aiCost: 'Uses 1 AI credit.', publishReply: 'Publish reply', publishing: 'Publishing…',
    replyPublished: 'Your public reply', replyOverwrite: 'Publishing again replaces this reply on Google.',
    postsTitle: 'Google posts', postsHint: 'A post stays visible on Google for about 7 days, so one per week keeps your profile fresh.',
    draftPost: 'Draft this week’s post', newPost: 'Write a post', noPosts: 'No posts yet.', lastPostDays: 'Last post {days} days ago', noPostYet: 'No post this week yet',
    postStatusDraft: 'Draft', postStatusScheduled: 'Scheduled', postStatusPublished: 'Live', postStatusFaded: 'Expired', postStatusFailed: 'Failed', edit: 'Edit',
    postTitle: 'Google post', postText: 'Text', postTextHint: 'Up to 1,500 characters. Links and phone numbers go in the button.',
    button: 'Button', noButton: 'No button', buttonLink: 'Button link', when: 'Publish on', whenHint: 'Leave empty to save as draft or publish now.',
    saveDraft: 'Save draft', schedule: 'Schedule', publishNow: 'Publish now', saving: 'Saving…',
    deletePost: 'Delete', cancelPost: 'Cancel post', confirmDelete: 'Remove this post?', publishedReadOnly: 'This post is live on Google and can no longer be changed.',
    ctaBOOK: 'Book', ctaLEARN_MORE: 'Learn more', ctaORDER: 'Order', ctaSHOP: 'Shop', ctaSIGN_UP: 'Sign up', ctaCALL: 'Call',
    settingsTitle: 'Google settings', autoReply: 'Answer 4- and 5-star reviews automatically',
    autoReplyHint: 'The AI publishes a reply right away (1 AI credit each). 1–3 stars always wait for you.',
    syncHours: 'Keep opening hours in sync', syncServices: 'Keep services and prices in sync',
    syncHint: 'When you change working hours or services in Zenno, Google is updated within a few minutes.',
    syncNow: 'Sync now', syncing: 'Syncing…', lastSynced: 'Last synced {date}', syncPending: 'Changes waiting to sync', syncError: 'Last sync failed: {error}',
    save: 'Save', close: 'Close', cancel: 'Cancel', chars: '{count} / {max}',
  },
  de: {
    googleTitle: 'Google-Unternehmensprofil', googleHint: 'Bewertungen beantworten, wöchentlich posten und Öffnungszeiten und Leistungen in der Google-Suche und Maps aktuell halten.',
    connectGoogle: 'Google verbinden', notConnected: 'Verbinden Sie Ihr Google-Unternehmensprofil, um Bewertungen zu sehen und Beiträge zu veröffentlichen.',
    openReviewLink: 'Bewertungslink', openMaps: 'In Google Maps', settings: 'Einstellungen',
    reviewsTitle: 'Google-Bewertungen', reviewsHint: 'Die KI entwirft eine Antwort in Ihrem Ton; Sie prüfen und veröffentlichen.', refresh: 'Aktualisieren', refreshing: 'Lädt…',
    noReviews: 'Noch keine Bewertungen.', noText: 'Nur Sterne, kein Text.',
    statusOpen: 'Offen', statusDraft: 'Entwurf bereit', statusReplied: 'Beantwortet', statusAuto: 'Von KI beantwortet', statusFailed: 'Nicht gesendet', reply: 'Antworten', view: 'Ansehen',
    reviewTitle: 'Bewertung von {name}', yourReply: 'Ihre Antwort', replyPlaceholder: 'Vielen Dank für Ihre Bewertung…',
    draftWithAi: 'Mit KI entwerfen', drafting: 'Wird entworfen…', aiCost: 'Verbraucht 1 KI-Guthaben.', publishReply: 'Antwort veröffentlichen', publishing: 'Wird veröffentlicht…',
    replyPublished: 'Ihre öffentliche Antwort', replyOverwrite: 'Erneutes Veröffentlichen ersetzt diese Antwort bei Google.',
    postsTitle: 'Google-Beiträge', postsHint: 'Ein Beitrag bleibt etwa 7 Tage bei Google sichtbar. Einer pro Woche hält Ihr Profil frisch.',
    draftPost: 'Beitrag der Woche entwerfen', newPost: 'Beitrag schreiben', noPosts: 'Noch keine Beiträge.', lastPostDays: 'Letzter Beitrag vor {days} Tagen', noPostYet: 'Diese Woche noch kein Beitrag',
    postStatusDraft: 'Entwurf', postStatusScheduled: 'Geplant', postStatusPublished: 'Live', postStatusFaded: 'Abgelaufen', postStatusFailed: 'Fehlgeschlagen', edit: 'Bearbeiten',
    postTitle: 'Google-Beitrag', postText: 'Text', postTextHint: 'Bis zu 1.500 Zeichen. Links und Telefonnummern gehören in den Button.',
    button: 'Button', noButton: 'Kein Button', buttonLink: 'Button-Link', when: 'Veröffentlichen am', whenHint: 'Leer lassen, um als Entwurf zu speichern oder sofort zu veröffentlichen.',
    saveDraft: 'Entwurf speichern', schedule: 'Planen', publishNow: 'Jetzt veröffentlichen', saving: 'Speichert…',
    deletePost: 'Löschen', cancelPost: 'Beitrag absagen', confirmDelete: 'Diesen Beitrag entfernen?', publishedReadOnly: 'Dieser Beitrag ist bei Google live und kann nicht mehr geändert werden.',
    ctaBOOK: 'Buchen', ctaLEARN_MORE: 'Mehr erfahren', ctaORDER: 'Bestellen', ctaSHOP: 'Einkaufen', ctaSIGN_UP: 'Registrieren', ctaCALL: 'Anrufen',
    settingsTitle: 'Google-Einstellungen', autoReply: '4- und 5-Sterne-Bewertungen automatisch beantworten',
    autoReplyHint: 'Die KI veröffentlicht sofort eine Antwort (je 1 KI-Guthaben). 1–3 Sterne warten immer auf Sie.',
    syncHours: 'Öffnungszeiten synchron halten', syncServices: 'Leistungen und Preise synchron halten',
    syncHint: 'Wenn Sie Arbeitszeiten oder Leistungen in Zenno ändern, wird Google innerhalb weniger Minuten aktualisiert.',
    syncNow: 'Jetzt synchronisieren', syncing: 'Synchronisiert…', lastSynced: 'Zuletzt synchronisiert {date}', syncPending: 'Änderungen warten auf Synchronisierung', syncError: 'Letzte Synchronisierung fehlgeschlagen: {error}',
    save: 'Speichern', close: 'Schließen', cancel: 'Abbrechen', chars: '{count} / {max}',
  },
  th: {
    googleTitle: 'Google Business Profile', googleHint: 'ตอบรีวิว โพสต์อัปเดตทุกสัปดาห์ และอัปเดตเวลาเปิดและบริการบน Google Search และ Maps',
    connectGoogle: 'เชื่อมต่อ Google', notConnected: 'เชื่อมต่อ Google Business Profile เพื่อดูรีวิวและเผยแพร่โพสต์',
    openReviewLink: 'ลิงก์รีวิว', openMaps: 'บน Google Maps', settings: 'การตั้งค่า',
    reviewsTitle: 'รีวิว Google', reviewsHint: 'AI ร่างคำตอบตามสไตล์ของร้าน คุณตรวจแล้วเผยแพร่', refresh: 'รีเฟรช', refreshing: 'กำลังโหลด…',
    noReviews: 'ยังไม่มีรีวิว', noText: 'ให้ดาวอย่างเดียว ไม่มีข้อความ',
    statusOpen: 'รอตอบ', statusDraft: 'มีร่างแล้ว', statusReplied: 'ตอบแล้ว', statusAuto: 'AI ตอบแล้ว', statusFailed: 'ส่งไม่สำเร็จ', reply: 'ตอบ', view: 'ดู',
    reviewTitle: 'รีวิวจาก {name}', yourReply: 'คำตอบของคุณ', replyPlaceholder: 'ขอบคุณสำหรับรีวิว…',
    draftWithAi: 'ร่างด้วย AI', drafting: 'กำลังร่าง…', aiCost: 'ใช้เครดิต AI 1 หน่วย', publishReply: 'เผยแพร่คำตอบ', publishing: 'กำลังเผยแพร่…',
    replyPublished: 'คำตอบสาธารณะของคุณ', replyOverwrite: 'การเผยแพร่อีกครั้งจะแทนที่คำตอบนี้บน Google',
    postsTitle: 'โพสต์ Google', postsHint: 'โพสต์จะแสดงบน Google ประมาณ 7 วัน โพสต์สัปดาห์ละครั้งช่วยให้โปรไฟล์สดใหม่',
    draftPost: 'ร่างโพสต์ประจำสัปดาห์', newPost: 'เขียนโพสต์', noPosts: 'ยังไม่มีโพสต์', lastPostDays: 'โพสต์ล่าสุดเมื่อ {days} วันก่อน', noPostYet: 'สัปดาห์นี้ยังไม่มีโพสต์',
    postStatusDraft: 'ร่าง', postStatusScheduled: 'ตั้งเวลาแล้ว', postStatusPublished: 'เผยแพร่อยู่', postStatusFaded: 'หมดอายุ', postStatusFailed: 'ล้มเหลว', edit: 'แก้ไข',
    postTitle: 'โพสต์ Google', postText: 'ข้อความ', postTextHint: 'ไม่เกิน 1,500 ตัวอักษร ลิงก์และเบอร์โทรใส่ในปุ่ม',
    button: 'ปุ่ม', noButton: 'ไม่มีปุ่ม', buttonLink: 'ลิงก์ของปุ่ม', when: 'เผยแพร่วันที่', whenHint: 'เว้นว่างเพื่อบันทึกร่างหรือเผยแพร่ทันที',
    saveDraft: 'บันทึกร่าง', schedule: 'ตั้งเวลา', publishNow: 'เผยแพร่ทันที', saving: 'กำลังบันทึก…',
    deletePost: 'ลบ', cancelPost: 'ยกเลิกโพสต์', confirmDelete: 'ลบโพสต์นี้?', publishedReadOnly: 'โพสต์นี้เผยแพร่บน Google แล้วและแก้ไขไม่ได้',
    ctaBOOK: 'จอง', ctaLEARN_MORE: 'ดูเพิ่มเติม', ctaORDER: 'สั่งซื้อ', ctaSHOP: 'ช้อป', ctaSIGN_UP: 'สมัคร', ctaCALL: 'โทร',
    settingsTitle: 'การตั้งค่า Google', autoReply: 'ตอบรีวิว 4 และ 5 ดาวอัตโนมัติ',
    autoReplyHint: 'AI จะเผยแพร่คำตอบทันที (ครั้งละ 1 เครดิต AI) รีวิว 1–3 ดาวจะรอคุณเสมอ',
    syncHours: 'ซิงก์เวลาเปิดทำการ', syncServices: 'ซิงก์บริการและราคา',
    syncHint: 'เมื่อคุณแก้เวลาทำงานหรือบริการใน Zenno ระบบจะอัปเดต Google ภายในไม่กี่นาที',
    syncNow: 'ซิงก์ตอนนี้', syncing: 'กำลังซิงก์…', lastSynced: 'ซิงก์ล่าสุด {date}', syncPending: 'มีการเปลี่ยนแปลงรอซิงก์', syncError: 'ซิงก์ครั้งล่าสุดล้มเหลว: {error}',
    save: 'บันทึก', close: 'ปิด', cancel: 'ยกเลิก', chars: '{count} / {max}',
  },
};
