import { supabase } from './supabase';

/**
 * Bearer token for calling edge functions as the signed-in admin. Functions that
 * act on a shop check this token; the anon key only identifies the project.
 */
export async function adminAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
}
