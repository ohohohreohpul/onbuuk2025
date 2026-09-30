// Calls the keyless agent-direct edge function from Vercel, and derives the
// request facts only Vercel can see reliably (client address, agent label).

const BUSINESS_TIMEZONE = 'Europe/Berlin';

/** Known AI agents by User-Agent. A label for the merchant only — never used for access decisions. */
const AGENT_LABELS: [RegExp, string][] = [
  [/ChatGPT|OAI-SearchBot|GPTBot/i, 'ChatGPT'],
  [/Perplexity/i, 'Perplexity'],
  [/Claude|Anthropic/i, 'Claude'],
  [/Gemini|Google-Extended|Googlebot/i, 'Google'],
  [/Applebot/i, 'Apple'],
  [/bingbot|Copilot/i, 'Microsoft Copilot'],
];

export interface DirectResponse {
  status: number;
  body: Record<string, unknown>;
}

export async function callDirect(payload: Record<string, unknown>): Promise<DirectResponse> {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
  if (!url || !anonKey) throw new Error('Supabase URL/anon key are not configured for Vercel functions');
  const res = await fetch(`${url}/functions/v1/agent-direct`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({ error: 'Invalid response' }))) as Record<string, unknown>;
  return { status: res.status, body };
}

/** First hop of x-forwarded-for, which Vercel sets from the real connection. */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  return forwarded.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
}

export function agentLabel(request: Request): string {
  const ua = request.headers.get('user-agent') ?? '';
  return AGENT_LABELS.find(([pattern]) => pattern.test(ua))?.[1] ?? 'AI assistant';
}

export function berlinToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIMEZONE }).format(now);
}
