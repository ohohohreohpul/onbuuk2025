import type { Translations } from '../../../lib/bookingLanguage';
import type { EmojiStyle, Habit, Initiative, Personality, ReplyLength } from './receptionistApi';

export const PERSONALITIES: Personality[] = ['warm', 'calm', 'cheerful', 'professional'];
export const LENGTHS: ReplyLength[] = ['short', 'balanced', 'detailed'];
export const EMOJI_STYLES: EmojiStyle[] = ['never', 'mirror', 'sometimes'];
export const INITIATIVES: Initiative[] = ['answer', 'guide', 'sell'];
export const HABITS: Habit[] = [
  'introduce_self', 'ask_needs_first', 'recommend', 'use_name', 'mention_promotion', 'suggest_gift', 'offer_alternatives', 'aftercare',
];

type Keys = Record<
  | `p_${Personality}` | `p_${Personality}Hint` | `p_${Personality}Sample` | `p_${Personality}More`
  | `l_${ReplyLength}` | `e_${EmojiStyle}` | `i_${Initiative}` | `i_${Initiative}Hint` | `h_${Habit}`
  | 'tab' | 'title' | 'hint' | 'personality' | 'length' | 'emoji' | 'initiative' | 'habits' | 'habitsHint'
  | 'briefing' | 'briefingHint' | 'briefingPlaceholder' | 'preview' | 'previewCustomer' | 'save' | 'saving' | 'saved'
  | 'saveFailed' | 'unsaved' | 'reset' | 'tryIt'
  | 'introNamed' | 'introShop'
  | 'learn' | 'learnTitle' | 'learnHint' | 'learnUrl' | 'learnGo' | 'learnBusy' | 'learnDone' | 'cancel' | 'close',
  string
>;

export const BRIEFING_TEXT: Translations<Keys> = {
  en: {
    introNamed: 'this is {name} from {shop}', introShop: 'this is {shop}',
    learn: 'Learn from my website', learnTitle: 'Learn from your website', learnHint: 'She reads your homepage and \'about us\' page and picks up your tone and atmosphere. You can check everything before saving.', learnUrl: 'Website address', learnGo: 'Read website', learnBusy: 'Reading your website…', learnDone: 'Taken from your website. Check it and save.', cancel: 'Cancel', close: 'Close',
    tab: 'Personality', title: 'Brief your receptionist', hint: 'Tell her who she is and how you want guests treated, like you would brief a new team member. Prices, times and offers always come from your app.',
    personality: 'Personality', length: 'How much she says', emoji: 'Emojis', initiative: 'How proactive', habits: 'Good habits', habitsHint: 'Little things a great receptionist does.',
    briefing: 'Your briefing', briefingHint: 'In your own words: the feeling of your shop, what matters to you, how to treat regulars or nervous first-timers.',
    briefingPlaceholder: 'We are a small family-run Thai spa. Treat everyone like a guest in our home. Many guests come with back pain, so ask how they feel. Regulars like to be recognised…',
    preview: 'How it sounds', previewCustomer: 'Hi, do you have time for a massage this week?',
    save: 'Save', saving: 'Saving…', saved: 'Saved', saveFailed: 'Could not save. Please try again.', unsaved: 'Unsaved changes', reset: 'Discard', tryIt: 'Try it in the chat',
    p_warm: 'Warm & caring', p_warmHint: 'Like welcoming a guest home', p_warmSample: 'Hi, {intro}, lovely to hear from you! This week we still have a few spots. Is it more for relaxing, or is something bothering you?', p_warmMore: 'Then I can suggest the right massage for you.',
    p_calm: 'Calm & elegant', p_calmHint: 'Quiet, high-end spa', p_calmSample: 'Good afternoon, {intro}. Thank you for your message. We do have time this week; which day would suit you?', p_calmMore: 'I am happy to recommend a treatment if you tell me what you would like.',
    p_cheerful: 'Cheerful & upbeat', p_cheerfulHint: 'Friendly, light humour', p_cheerfulSample: 'Hey, {intro}! A massage this week sounds like a great plan. Which day works for you?', p_cheerfulMore: 'Tell me if you like it soft or strong and I\'ll find the perfect one.',
    p_professional: 'Professional', p_professionalHint: 'Polite, quick, to the point', p_professionalSample: 'Hello, {intro}. Yes, we have availability this week. Which day and time would you prefer?', p_professionalMore: 'Let me know the treatment and I will check the exact times.',
    l_short: 'Short', l_balanced: 'Balanced', l_detailed: 'Detailed',
    e_never: 'Never', e_mirror: 'Like the guest', e_sometimes: 'Now and then',
    i_answer: 'Just answer', i_answerHint: 'Answers questions, never pushes.', i_guide: 'Guide to booking', i_guideHint: 'Suggests the next step after answering.', i_sell: 'Sell actively', i_sellHint: 'Recommends, mentions vouchers and offers.',
    h_introduce_self: 'Introduce herself in the first message', h_ask_needs_first: 'Ask what they need before listing treatments', h_recommend: 'Recommend one fitting treatment', h_use_name: 'Use the guest\'s first name',
    h_mention_promotion: 'Mention the current promotion', h_suggest_gift: 'Suggest a voucher for birthdays and gifts', h_offer_alternatives: 'Offer other times right away when full', h_aftercare: 'Add a caring tip after booking',
  },
  de: {
    introNamed: 'hier ist {name} von {shop}', introShop: 'hier ist {shop}',
    learn: 'Von meiner Website lernen', learnTitle: 'Von Ihrer Website lernen', learnHint: 'Sie liest Ihre Startseite und die Seite „Über uns“ und übernimmt Ton und Atmosphäre. Sie können alles prüfen, bevor Sie speichern.', learnUrl: 'Website-Adresse', learnGo: 'Website lesen', learnBusy: 'Website wird gelesen…', learnDone: 'Von Ihrer Website übernommen. Bitte prüfen und speichern.', cancel: 'Abbrechen', close: 'Schließen',
    tab: 'Persönlichkeit', title: 'Briefen Sie Ihre Rezeption', hint: 'Sagen Sie ihr, wer sie ist und wie Gäste behandelt werden sollen – wie bei einer neuen Kollegin. Preise, Zeiten und Angebote kommen immer aus Ihrer App.',
    personality: 'Persönlichkeit', length: 'Wie viel sie schreibt', emoji: 'Emojis', initiative: 'Wie aktiv', habits: 'Gute Gewohnheiten', habitsHint: 'Kleinigkeiten, die eine tolle Rezeption ausmachen.',
    briefing: 'Ihr Briefing', briefingHint: 'In Ihren Worten: das Gefühl Ihres Ladens, was Ihnen wichtig ist, wie Stammgäste oder unsichere Neukund:innen behandelt werden.',
    briefingPlaceholder: 'Wir sind ein kleines Thai-Spa in Familienhand. Jeder Gast soll sich wie bei uns zu Hause fühlen. Viele kommen mit Rückenschmerzen, also fragen, wie es ihnen geht. Stammgäste möchten wiedererkannt werden…',
    preview: 'So klingt sie', previewCustomer: 'Hallo, habt ihr diese Woche Zeit für eine Massage?',
    save: 'Speichern', saving: 'Wird gespeichert…', saved: 'Gespeichert', saveFailed: 'Speichern fehlgeschlagen. Bitte erneut versuchen.', unsaved: 'Nicht gespeichert', reset: 'Verwerfen', tryIt: 'Im Chat ausprobieren',
    p_warm: 'Herzlich', p_warmHint: 'Wie Gäste zu Hause empfangen', p_warmSample: 'Hallo, {intro}, schön, dass du schreibst! Diese Woche haben wir noch ein paar Plätze frei. Eher zum Entspannen, oder zwickt irgendwo etwas?', p_warmMore: 'Dann kann ich dir die passende Massage empfehlen.',
    p_calm: 'Ruhig & elegant', p_calmHint: 'Stilles, gehobenes Spa', p_calmSample: 'Guten Tag, {intro}. Vielen Dank für Ihre Nachricht. Diese Woche haben wir noch Zeit; welcher Tag passt Ihnen?', p_calmMore: 'Gerne empfehle ich Ihnen eine Behandlung, wenn Sie mir sagen, was Sie sich wünschen.',
    p_cheerful: 'Fröhlich', p_cheerfulHint: 'Locker, mit etwas Humor', p_cheerfulSample: 'Hey, {intro}! Massage diese Woche klingt nach einem guten Plan. Welcher Tag passt dir?', p_cheerfulMore: 'Sag mir, ob sanft oder kräftig, dann finde ich die perfekte.',
    p_professional: 'Professionell', p_professionalHint: 'Höflich, schnell, auf den Punkt', p_professionalSample: 'Guten Tag, {intro}. Ja, diese Woche ist noch etwas frei. Welcher Tag und welche Uhrzeit wären Ihnen recht?', p_professionalMore: 'Nennen Sie mir die Behandlung, dann prüfe ich die genauen Zeiten.',
    l_short: 'Kurz', l_balanced: 'Mittel', l_detailed: 'Ausführlich',
    e_never: 'Nie', e_mirror: 'Wie der Gast', e_sometimes: 'Ab und zu',
    i_answer: 'Nur antworten', i_answerHint: 'Beantwortet Fragen, drängt nie.', i_guide: 'Zur Buchung führen', i_guideHint: 'Schlägt nach der Antwort den nächsten Schritt vor.', i_sell: 'Aktiv verkaufen', i_sellHint: 'Empfiehlt, erwähnt Gutscheine und Angebote.',
    h_introduce_self: 'Stellt sich in der ersten Nachricht vor', h_ask_needs_first: 'Fragt erst nach dem Wunsch, dann Behandlungen', h_recommend: 'Empfiehlt eine passende Behandlung', h_use_name: 'Spricht Gäste mit Vornamen an',
    h_mention_promotion: 'Erwähnt die aktuelle Aktion', h_suggest_gift: 'Schlägt Gutscheine bei Geburtstag & Geschenk vor', h_offer_alternatives: 'Bietet sofort andere Zeiten an, wenn voll', h_aftercare: 'Gibt nach der Buchung einen kleinen Tipp',
  },
  th: {
    introNamed: '{name} จาก {shop} ค่ะ', introShop: '{shop} ค่ะ',
    learn: 'เรียนรู้จากเว็บไซต์ของฉัน', learnTitle: 'เรียนรู้จากเว็บไซต์ของคุณ', learnHint: 'AI จะอ่านหน้าแรกและหน้าเกี่ยวกับเรา แล้วจับน้ำเสียงและบรรยากาศของร้าน คุณตรวจดูได้ก่อนบันทึก', learnUrl: 'ที่อยู่เว็บไซต์', learnGo: 'อ่านเว็บไซต์', learnBusy: 'กำลังอ่านเว็บไซต์…', learnDone: 'นำมาจากเว็บไซต์แล้ว กรุณาตรวจและบันทึก', cancel: 'ยกเลิก', close: 'ปิด',
    tab: 'บุคลิก', title: 'บรีฟพนักงานต้อนรับของคุณ', hint: 'บอกว่าเธอเป็นใครและควรดูแลลูกค้าอย่างไร เหมือนบรีฟพนักงานใหม่ ราคา เวลา และโปรโมชั่นจะมาจากแอปเสมอ',
    personality: 'บุคลิก', length: 'ความยาวของคำตอบ', emoji: 'อีโมจิ', initiative: 'ความกระตือรือร้น', habits: 'นิสัยที่ดี', habitsHint: 'สิ่งเล็กๆ ที่พนักงานต้อนรับเก่งๆ ทำ',
    briefing: 'บรีฟของคุณ', briefingHint: 'เขียนด้วยคำของคุณเอง: บรรยากาศของร้าน สิ่งที่สำคัญ วิธีดูแลลูกค้าประจำหรือลูกค้าใหม่',
    briefingPlaceholder: 'เราเป็นร้านนวดไทยเล็กๆ ของครอบครัว อยากให้ทุกคนรู้สึกเหมือนมาบ้านเรา ลูกค้าหลายคนปวดหลัง ให้ถามอาการก่อน ลูกค้าประจำชอบให้จำได้…',
    preview: 'ตัวอย่างการตอบ', previewCustomer: 'สวัสดีค่ะ อาทิตย์นี้มีคิวนวดว่างไหมคะ?',
    save: 'บันทึก', saving: 'กำลังบันทึก…', saved: 'บันทึกแล้ว', saveFailed: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง', unsaved: 'ยังไม่ได้บันทึก', reset: 'ยกเลิก', tryIt: 'ลองในแชท',
    p_warm: 'อบอุ่น ใส่ใจ', p_warmHint: 'เหมือนต้อนรับแขกที่บ้าน', p_warmSample: 'สวัสดีค่ะ {intro} ขอบคุณที่ทักมานะคะ อาทิตย์นี้ยังมีคิวว่างอยู่ค่ะ อยากผ่อนคลาย หรือมีปวดตรงไหนไหมคะ?', p_warmMore: 'จะได้แนะนำนวดที่เหมาะให้ค่ะ',
    p_calm: 'สงบ หรูหรา', p_calmHint: 'สปาระดับพรีเมียม', p_calmSample: 'สวัสดีค่ะ {intro} ยินดีให้บริการค่ะ อาทิตย์นี้ยังมีเวลาว่าง สะดวกวันไหนคะ?', p_calmMore: 'หากบอกความต้องการ ดิฉันยินดีแนะนำทรีตเมนต์ให้ค่ะ',
    p_cheerful: 'ร่าเริง สดใส', p_cheerfulHint: 'เป็นกันเอง มีอารมณ์ขัน', p_cheerfulSample: 'หวัดดีค่า {intro} เองค่ะ นวดอาทิตย์นี้ไอเดียดีมาก! สะดวกวันไหนคะ?', p_cheerfulMore: 'ชอบนวดเบาหรือหนักบอกได้เลย เดี๋ยวหาแบบที่ใช่ให้ค่ะ',
    p_professional: 'มืออาชีพ', p_professionalHint: 'สุภาพ รวดเร็ว ตรงประเด็น', p_professionalSample: 'สวัสดีค่ะ {intro} อาทิตย์นี้มีคิวว่างค่ะ สะดวกวันและเวลาไหนคะ?', p_professionalMore: 'แจ้งบริการที่ต้องการ แล้วจะเช็กเวลาให้ค่ะ',
    l_short: 'สั้น', l_balanced: 'ปานกลาง', l_detailed: 'ละเอียด',
    e_never: 'ไม่ใช้', e_mirror: 'ตามลูกค้า', e_sometimes: 'ใช้บ้าง',
    i_answer: 'ตอบอย่างเดียว', i_answerHint: 'ตอบคำถาม ไม่เร่งขาย', i_guide: 'พาไปสู่การจอง', i_guideHint: 'ตอบแล้วชวนขั้นต่อไป', i_sell: 'ขายเชิงรุก', i_sellHint: 'แนะนำ บอกบัตรของขวัญและโปรโมชั่น',
    h_introduce_self: 'แนะนำตัวในข้อความแรก', h_ask_needs_first: 'ถามความต้องการก่อนเสนอบริการ', h_recommend: 'แนะนำบริการที่เหมาะหนึ่งอย่าง', h_use_name: 'เรียกชื่อลูกค้า',
    h_mention_promotion: 'บอกโปรโมชั่นปัจจุบัน', h_suggest_gift: 'แนะนำบัตรของขวัญเมื่อพูดถึงวันเกิด/ของขวัญ', h_offer_alternatives: 'เสนอเวลาอื่นทันทีเมื่อเต็ม', h_aftercare: 'ให้คำแนะนำเล็กๆ หลังจอง',
  },
};
