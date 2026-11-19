import type { LucideIcon } from 'lucide-react';

export interface AnnouncementSlide {
  id: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
  points?: string[];
}

export type SlideCopy = Pick<AnnouncementSlide, 'eyebrow' | 'title' | 'body' | 'points'>;

/**
 * A one-time "What's new" popup. Each admin sees a key once; a new key shows a
 * new announcement to everyone. English lives in the slides, other languages
 * in `translations` by slide id.
 */
export interface Announcement {
  key: string;
  slides: AnnouncementSlide[];
  translations: Record<'de' | 'th', Record<string, SlideCopy>>;
  /** Label of the last slide's button when it leads somewhere (instead of "Get started"). */
  finalActionLabel?: Record<'en' | 'de' | 'th', string>;
}
