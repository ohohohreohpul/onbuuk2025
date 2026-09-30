// ---------------------------------------------------------------------------
// Booking attribution: where did this customer come from?
// The first page view of a visit captures UTM tags and the referrer (they are
// lost once the booking flow navigates); booking inserts attach them.
// Channel meanings: supabase/migrations/20260930140000_booking_attribution.sql
// ---------------------------------------------------------------------------

export type BookingChannel =
  | 'ai_booked'
  | 'ai_referral'
  | 'search'
  | 'social'
  | 'email'
  | 'referral'
  | 'direct'
  | 'admin';

export interface Attribution {
  channel: BookingChannel;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer_host: string | null;
  ai_agent: string | null;
}

const STORAGE_KEY = 'zenno_attribution';
const MAX_FIELD = 100;

const AI_SOURCES: [RegExp, string][] = [
  [/(^|\.)chatgpt\.com$|(^|\.)openai\.com$|^chatgpt$/, 'ChatGPT'],
  [/(^|\.)perplexity\.ai$|^perplexity$/, 'Perplexity'],
  [/(^|\.)gemini\.google\.com$|^gemini$/, 'Gemini'],
  [/(^|\.)copilot\.microsoft\.com$|^copilot$/, 'Microsoft Copilot'],
  [/(^|\.)claude\.ai$|^claude$/, 'Claude'],
  [/(^|\.)you\.com$|(^|\.)phind\.com$/, 'AI search'],
];
const SEARCH = /(^|\.)(google|bing|duckduckgo|ecosia|yahoo|qwant|startpage)\.[a-z.]+$/;
const SOCIAL = /(^|\.)(instagram|facebook|fb|tiktok|pinterest|linkedin|x|twitter|t|youtube|whatsapp|threads)\.(com|me|co|net)$/;
const SOCIAL_SOURCES = /^(instagram|ig|facebook|fb|meta|tiktok|pinterest|linkedin|twitter|x|youtube|whatsapp|threads)$/;

const clean = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim().toLowerCase().slice(0, MAX_FIELD);
  return trimmed ? trimmed : null;
};

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function aiAgentFor(value: string | null): string | null {
  if (!value) return null;
  return AI_SOURCES.find(([pattern]) => pattern.test(value))?.[1] ?? null;
}

/** Classify a visit. UTM tags win over the referrer; own-site referrers count as direct. */
export function classifyVisit(args: {
  search: string;
  referrer: string | null;
  ownHost: string;
}): Attribution {
  const params = new URLSearchParams(args.search);
  const utmSource = clean(params.get('utm_source'));
  const utmMedium = clean(params.get('utm_medium'));
  const utmCampaign = clean(params.get('utm_campaign'));
  const rawReferrer = hostOf(args.referrer);
  const referrerHost = rawReferrer && rawReferrer !== args.ownHost.replace(/^www\./, '') ? rawReferrer : null;

  const aiAgent = aiAgentFor(utmSource) ?? aiAgentFor(referrerHost);
  const base = { utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign, referrer_host: referrerHost, ai_agent: aiAgent };

  if (aiAgent) return { ...base, channel: 'ai_referral' };
  if (utmMedium === 'email' || utmSource === 'newsletter') return { ...base, channel: 'email' };
  if ((utmSource && SOCIAL_SOURCES.test(utmSource)) || (referrerHost && SOCIAL.test(referrerHost))) return { ...base, channel: 'social' };
  if ((utmSource && /^(google|bing|duckduckgo|ecosia)$/.test(utmSource)) || (referrerHost && SEARCH.test(referrerHost))) {
    return { ...base, channel: 'search' };
  }
  if (utmSource || referrerHost) return { ...base, channel: 'referral' };
  return { ...base, channel: 'direct' };
}

/** Call once on app start: keeps the first touch of this visit. */
export function captureAttribution(): void {
  try {
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    const visit = classifyVisit({
      search: window.location.search,
      referrer: document.referrer || null,
      ownHost: window.location.hostname,
    });
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(visit));
  } catch (err) {
    // Storage can be blocked (private mode); bookings then count as direct.
    console.warn('Attribution capture unavailable', err);
  }
}

const DIRECT: Attribution = { channel: 'direct', utm_source: null, utm_medium: null, utm_campaign: null, referrer_host: null, ai_agent: null };

/** Fields to spread into a public booking insert. */
export function bookingAttribution(): Attribution {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? { ...DIRECT, ...(JSON.parse(stored) as Partial<Attribution>) } : DIRECT;
  } catch {
    return DIRECT;
  }
}

export const ADMIN_ATTRIBUTION: Attribution = { ...DIRECT, channel: 'admin' };
