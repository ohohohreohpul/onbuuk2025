import { supabase } from '../../../lib/supabase';

export interface ExternalCalendar {
  id: string;
  name: string;
  ics_url: string | null;
  provider: 'ics' | 'google';
  is_active: boolean;
  last_synced_at: string | null;
  last_error: string | null;
  busy_count: number;
}

interface SyncResult {
  calendar_id: string;
  busy_count?: number;
  error?: string;
}

const CALENDAR_COLUMNS = 'id, name, ics_url, provider, is_active, last_synced_at, last_error, busy_count';
const LINK_PATTERN = /^(https|webcals?):\/\/[^\s]+$/i;
const MAX_NAME_LENGTH = 80;

/** Returns a user-facing problem with the pasted link, or null when it looks usable. */
export function validateCalendarLink(raw: string): string | null {
  const link = raw.trim();
  if (!link) return 'Paste the calendar link.';
  if (!LINK_PATTERN.test(link)) return 'The link must start with https:// or webcal://';
  if (link.includes('/functions/v1/calendar-feed')) {
    return 'This is a Zenno booking link. Paste the link of the other calendar instead.';
  }
  if (link.length > 2048) return 'This link is too long.';
  return null;
}

export async function listCalendars(specialistId: string): Promise<ExternalCalendar[]> {
  const { data, error } = await supabase
    .from('external_calendars')
    .select(CALENDAR_COLUMNS)
    .eq('specialist_id', specialistId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as ExternalCalendar[];
}

export async function syncCalendars(calendarId?: string): Promise<SyncResult[]> {
  const { data, error } = await supabase.functions.invoke('sync-external-calendars', {
    body: calendarId ? { calendar_id: calendarId } : {},
  });
  if (error) throw error;
  return ((data as { results?: SyncResult[] } | null)?.results ?? []);
}

export async function addCalendar(input: {
  businessId: string;
  specialistId: string;
  name: string;
  link: string;
}): Promise<ExternalCalendar> {
  const { data, error } = await supabase
    .from('external_calendars')
    .insert({
      business_id: input.businessId,
      specialist_id: input.specialistId,
      name: input.name.trim().slice(0, MAX_NAME_LENGTH) || 'Calendar',
      ics_url: input.link.trim(),
      provider: 'ics',
    })
    .select(CALENDAR_COLUMNS)
    .single();
  if (error) throw error;
  return data as ExternalCalendar;
}

export async function setCalendarActive(calendarId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('external_calendars')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', calendarId);
  if (error) throw error;
}

export async function removeCalendar(calendarId: string): Promise<void> {
  const { error } = await supabase.from('external_calendars').delete().eq('id', calendarId);
  if (error) throw error;
}

export function feedUrl(token: string): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed?token=${token}`;
}

export async function getFeedToken(specialistId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('calendar_feeds')
    .select('token')
    .eq('specialist_id', specialistId)
    .maybeSingle();
  if (error) throw error;
  return (data as { token: string } | null)?.token ?? null;
}

/** Creates the link, or replaces it so the old one stops working. */
export async function createFeedToken(businessId: string, specialistId: string): Promise<string> {
  const { error: deleteError } = await supabase.from('calendar_feeds').delete().eq('specialist_id', specialistId);
  if (deleteError) throw deleteError;

  const { data, error } = await supabase
    .from('calendar_feeds')
    .insert({ business_id: businessId, specialist_id: specialistId })
    .select('token')
    .single();
  if (error) throw error;
  return (data as { token: string }).token;
}
