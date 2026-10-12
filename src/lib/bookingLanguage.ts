import { useTenant } from './tenantContext';
import { DEFAULT_CUSTOM_TEXTS } from './bookingCustomizationDefaults';

export type BookingLanguage = 'en' | 'de' | 'th';

export const BOOKING_LANGUAGES: { value: BookingLanguage; label: string }[] = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
  { value: 'th', label: 'ไทย (Thai)' },
];

/** Per-component text tables: every key must exist in every language. */
export type Translations<T extends Record<string, string>> = Record<BookingLanguage, T>;

const LOCALES: Record<BookingLanguage, string> = { en: 'en-US', de: 'de-DE', th: 'th-TH' };

/**
 * Language of the current business's customer-facing pages (businesses.language).
 * Returns the matching text table and a locale for dates and numbers.
 */
export function useBookingText<T extends Record<string, string>>(translations: Translations<T>) {
  const { language } = useTenant();
  const lang: BookingLanguage = language === 'de' || language === 'th' ? language : 'en';
  return { t: translations[lang], lang, locale: LOCALES[lang] };
}

/** Fill {placeholders} in a translated string. */
export const fillText = (text: string, values: Record<string, string | number>): string =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));

/**
 * A shop's own text (Settings > Booking Form) wins; an empty one or one that is
 * just an English default falls back to the translation in the shop's language.
 */
export function customOr(custom: string | null | undefined, translated: string, englishDefault: string): string {
  const text = custom?.trim();
  if (!text || text === englishDefault || DEFAULT_CUSTOM_TEXTS.has(text)) return translated;
  return text;
}
