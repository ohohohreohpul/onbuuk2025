import type { Translations } from '../../../lib/bookingLanguage';

type Keys =
  | 'button' | 'title' | 'usingZenno' | 'usingZennoHint' | 'usingOwn' | 'usingOwnHint'
  | 'apiKey' | 'apiKeyHint' | 'connect' | 'connecting' | 'disconnect' | 'disconnecting' | 'confirmDisconnect'
  | 'needsEmpty' | 'close';

export const OWN_ZERNIO_TEXT: Translations<Record<Keys, string>> = {
  en: {
    button: 'Zernio account', title: 'Zernio account',
    usingZenno: 'Using Zenno’s Zernio account', usingZennoHint: 'Included in your plan. Connect your own Zernio account if you want to manage and pay for it yourself.',
    usingOwn: 'Using your own Zernio account', usingOwnHint: 'Your Instagram, Facebook and Google connections, messages and reviews run through your Zernio account and its billing.',
    apiKey: 'Zernio API key', apiKeyHint: 'In Zernio: Settings → API keys. Zenno stores it encrypted and sets up the webhook for you.',
    connect: 'Use my Zernio account', connecting: 'Connecting…', disconnect: 'Switch back to Zenno’s account', disconnecting: 'Switching…',
    confirmDisconnect: 'Switch back to Zenno’s Zernio account?',
    needsEmpty: 'Disconnect all Instagram, Facebook and Google accounts before switching; you connect them again afterwards.', close: 'Close',
  },
  de: {
    button: 'Zernio-Konto', title: 'Zernio-Konto',
    usingZenno: 'Zennos Zernio-Konto wird genutzt', usingZennoHint: 'In Ihrem Tarif enthalten. Verbinden Sie Ihr eigenes Zernio-Konto, wenn Sie es selbst verwalten und bezahlen möchten.',
    usingOwn: 'Ihr eigenes Zernio-Konto wird genutzt', usingOwnHint: 'Ihre Instagram-, Facebook- und Google-Verbindungen, Nachrichten und Bewertungen laufen über Ihr Zernio-Konto und dessen Abrechnung.',
    apiKey: 'Zernio-API-Schlüssel', apiKeyHint: 'In Zernio: Settings → API keys. Zenno speichert ihn verschlüsselt und richtet den Webhook für Sie ein.',
    connect: 'Mein Zernio-Konto nutzen', connecting: 'Wird verbunden…', disconnect: 'Zurück zu Zennos Konto', disconnecting: 'Wird umgestellt…',
    confirmDisconnect: 'Zurück zu Zennos Zernio-Konto wechseln?',
    needsEmpty: 'Trennen Sie vor dem Wechsel alle Instagram-, Facebook- und Google-Konten; danach verbinden Sie sie neu.', close: 'Schließen',
  },
  th: {
    button: 'บัญชี Zernio', title: 'บัญชี Zernio',
    usingZenno: 'ใช้บัญชี Zernio ของ Zenno', usingZennoHint: 'รวมอยู่ในแพ็กเกจของคุณ เชื่อมต่อบัญชี Zernio ของคุณเองหากต้องการจัดการและชำระเงินเอง',
    usingOwn: 'ใช้บัญชี Zernio ของคุณเอง', usingOwnHint: 'การเชื่อมต่อ Instagram, Facebook และ Google ข้อความและรีวิว จะทำงานผ่านบัญชี Zernio และการเรียกเก็บเงินของคุณ',
    apiKey: 'Zernio API key', apiKeyHint: 'ใน Zernio: Settings → API keys Zenno เก็บแบบเข้ารหัสและตั้งค่า webhook ให้',
    connect: 'ใช้บัญชี Zernio ของฉัน', connecting: 'กำลังเชื่อมต่อ…', disconnect: 'กลับไปใช้บัญชีของ Zenno', disconnecting: 'กำลังเปลี่ยน…',
    confirmDisconnect: 'กลับไปใช้บัญชี Zernio ของ Zenno?',
    needsEmpty: 'ยกเลิกการเชื่อมต่อ Instagram, Facebook และ Google ทั้งหมดก่อนเปลี่ยน แล้วเชื่อมต่อใหม่ภายหลัง', close: 'ปิด',
  },
};
