// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Zenno help centre (docs.zennohq.com). English at the root, German under /de/, Thai under /th/.
// Pages missing in a language fall back to English with a note.
export default defineConfig({
	site: 'https://docs.zennohq.com',
	integrations: [
		starlight({
			title: { en: 'Zenno Help', de: 'Zenno Hilfe', th: 'ศูนย์ช่วยเหลือ Zenno' },
			description: 'Step-by-step help for Zenno: POS calendar, bookings, vouchers, payments and the AI receptionist.',
			logo: { light: './src/assets/zenno-logo.svg', dark: './src/assets/zenno-logo-light.svg', replacesTitle: true },
			favicon: '/favicon.svg',
			defaultLocale: 'root',
			locales: {
				root: { label: 'English', lang: 'en' },
				de: { label: 'Deutsch', lang: 'de' },
				th: { label: 'ไทย', lang: 'th' },
			},
			customCss: ['./src/styles/zenno.css'],
			head: [
				{ tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } },
				{ tag: 'link', attrs: { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap' } },
			],
			social: [{ icon: 'email', label: 'support@zennohq.com', href: 'mailto:support@zennohq.com' }],
			lastUpdated: true,
			sidebar: [
				{ label: 'Start here', translations: { de: 'Erste Schritte', th: 'เริ่มต้นใช้งาน' }, items: [{ autogenerate: { directory: 'start' } }] },
				{ label: 'POS & calendar', translations: { de: 'POS & Kalender', th: 'POS และปฏิทิน' }, items: [{ autogenerate: { directory: 'pos' } }] },
				{ label: 'Bookings & customers', translations: { de: 'Buchungen & Kund:innen', th: 'การจองและลูกค้า' }, items: [{ autogenerate: { directory: 'customers' } }] },
				{ label: 'Vouchers & money', translations: { de: 'Gutscheine & Geld', th: 'บัตรของขวัญและการเงิน' }, items: [{ autogenerate: { directory: 'money' } }] },
				{ label: 'AI receptionist', translations: { de: 'KI-Rezeption', th: 'พนักงานต้อนรับ AI' }, items: [{ autogenerate: { directory: 'ai-receptionist' } }] },
				{ label: 'Team & settings', translations: { de: 'Team & Einstellungen', th: 'ทีมและการตั้งค่า' }, items: [{ autogenerate: { directory: 'settings' } }] },
				{ label: 'Help', translations: { de: 'Hilfe', th: 'ความช่วยเหลือ' }, items: [{ autogenerate: { directory: 'help' } }] },
			],
		}),
	],
});
