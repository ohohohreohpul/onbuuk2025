import { useTenant } from './tenantContext';

export type BookingLanguage = 'en' | 'de';

/** Per-component text tables: every key must exist in both languages. */
export type Translations<T extends Record<string, string>> = Record<BookingLanguage, T>;

const LOCALES: Record<BookingLanguage, string> = { en: 'en-US', de: 'de-DE' };

/**
 * Language of the current business's customer-facing pages (businesses.language).
 * Returns the matching text table and a locale for dates and numbers.
 */
export function useBookingText<T extends Record<string, string>>(translations: Translations<T>) {
  const { language } = useTenant();
  const lang: BookingLanguage = language === 'de' ? 'de' : 'en';
  return { t: translations[lang], lang, locale: LOCALES[lang] };
}

/** Fill {placeholders} in a translated string. */
export const fillText = (text: string, values: Record<string, string | number>): string =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
