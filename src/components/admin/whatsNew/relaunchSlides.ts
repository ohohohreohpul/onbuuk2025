import { Bell, CalendarX2, Gift, LayoutDashboard, Receipt, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';

export interface AnnouncementSlide {
  id: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
  points?: string[];
}

/** Bump the key to show a new announcement to everyone once. */
export const RELAUNCH_ANNOUNCEMENT_KEY = 'zennohq-relaunch-2026-09';

export const RELAUNCH_SLIDES: AnnouncementSlide[] = [
  {
    id: 'welcome',
    icon: Sparkles,
    eyebrow: 'A new chapter',
    title: 'Buuk is now part of ZennoHQ',
    body:
      'Same product, same team behind your bookings, now with more people building it. Your services, customers, bookings, gift cards and settings are exactly where you left them. Nothing to set up again.',
    points: ['Your data and links stay the same', 'Your customers see no interruption', 'Here is what we have built for you'],
  },
  {
    id: 'action-centre',
    icon: Bell,
    eyebrow: "What's new · 1 of 6",
    title: 'Action Centre',
    body:
      'Your daily to-do list, built from your own bookings. It shows you what needs attention, what money you can still recover, and the one button that fixes it.',
    points: ['Refill cancelled slots', 'Collect unpaid fees', 'Win back regulars who have not returned'],
  },
  {
    id: 'no-shows',
    icon: CalendarX2,
    eyebrow: "What's new · 2 of 6",
    title: 'No-show management',
    body:
      'Mark a no-show in one click and settle the fee your way. Every no-show appears in one list, so nothing slips through.',
    points: ['Charge the card saved at booking', 'Record cash or bank transfer, or waive it', 'Spot repeat no-shows at a glance'],
  },
  {
    id: 'gift-cards',
    icon: Gift,
    eyebrow: "What's new · 3 of 6",
    title: 'Gift cards, easier to find',
    body:
      'Choose how your gift card codes look, and find any card in seconds at the counter.',
    points: ['Pick your code format, e.g. 6 digits or SPA-483921', 'Look up any card by typing or scanning its code', 'Redeem in person with a live balance'],
  },
  {
    id: 'tax',
    icon: Receipt,
    eyebrow: "What's new · 4 of 6",
    title: 'Tax and invoice management',
    body:
      'Keep your takings and paperwork in one place, ready when your accountant asks.',
    points: ['Log cash takings day by day', 'Import revenue from other tools', 'Store tax documents alongside your reports'],
  },
  {
    id: 'security',
    icon: ShieldCheck,
    eyebrow: "What's new · 5 of 6",
    title: 'Stronger security',
    body:
      'We have tightened who can see and change what, so your business and your customers stay protected.',
    points: ['Every business is fully separated', 'Team permissions are enforced on our servers', 'Plan and billing settings are locked down'],
  },
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    eyebrow: "What's new · 6 of 6",
    title: 'A more intelligent dashboard',
    body:
      'Numbers you can trust. Visits, spend and no-shows are calculated live from your bookings, so every screen tells the same story.',
    points: ['Accurate visits and spend per customer', 'Clear next steps on every booking', 'One place to see what matters today'],
  },
];
