import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { BOOKING_LANGUAGES, BookingLanguage, Translations } from './bookingLanguage';

/**
 * Language of the admin panel, chosen per person (admin_users.ui_language).
 * Independent of the shop's booking-page language. Until the saved choice
 * loads, the last choice on this device or the browser language is used.
 */
export type AdminLanguage = BookingLanguage;

export const ADMIN_LANGUAGES = BOOKING_LANGUAGES;

const STORAGE_KEY = 'admin_ui_language';
const LOCALES: Record<AdminLanguage, string> = { en: 'en-US', de: 'de-DE', th: 'th-TH-u-ca-gregory' }; // Gregorian years: shops are in Germany

const isAdminLanguage = (value: unknown): value is AdminLanguage =>
  value === 'en' || value === 'de' || value === 'th';

function readCachedLanguage(): AdminLanguage | null {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    return isAdminLanguage(cached) ? cached : null;
  } catch {
    return null;
  }
}

function writeCachedLanguage(language: AdminLanguage): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Private mode or blocked storage: the saved account choice still applies.
  }
}

function browserLanguage(): AdminLanguage {
  const code = (typeof navigator !== 'undefined' ? navigator.language : 'en').slice(0, 2).toLowerCase();
  return isAdminLanguage(code) ? code : 'en';
}

interface AdminLanguageContextValue {
  language: AdminLanguage;
  setLanguage: (language: AdminLanguage) => Promise<void>;
}

const AdminLanguageContext = createContext<AdminLanguageContextValue>({
  language: 'en',
  setLanguage: async () => undefined,
});

export function AdminLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AdminLanguage>(() => readCachedLanguage() ?? browserLanguage());

  useEffect(() => {
    let cancelled = false;
    const loadSavedLanguage = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('admin_users')
        .select('ui_language')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error('Could not load the admin language:', error);
        return;
      }
      if (!cancelled && isAdminLanguage(data?.ui_language)) {
        setLanguageState(data.ui_language);
        writeCachedLanguage(data.ui_language);
      }
    };
    loadSavedLanguage();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback(async (next: AdminLanguage) => {
    setLanguageState(next);
    writeCachedLanguage(next);
    const { error } = await supabase.rpc('set_my_ui_language', { p_language: next });
    if (error) console.error('Could not save the admin language:', error);
  }, []);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return <AdminLanguageContext.Provider value={value}>{children}</AdminLanguageContext.Provider>;
}

export function useAdminLanguage(): AdminLanguageContextValue {
  return useContext(AdminLanguageContext);
}

/** Text table for the current admin language, plus a locale for dates and numbers. */
export function useAdminText<T extends Record<string, string>>(translations: Translations<T>) {
  const { language } = useAdminLanguage();
  return { t: translations[language], lang: language, locale: LOCALES[language] };
}
