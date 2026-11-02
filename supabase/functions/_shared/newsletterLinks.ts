/**
 * Customer-facing newsletter links. They go through /api/n on the booking host
 * (api/n.ts), which forwards to the marketing-unsubscribe edge function.
 */
const PAGE_BASE = Deno.env.get("NEWSLETTER_PAGE_URL") ?? "https://book.zennohq.com/api/n";

export const unsubscribeUrl = (token: string) => `${PAGE_BASE}?t=${encodeURIComponent(token)}`;
export const confirmNewsletterUrl = (token: string) => `${PAGE_BASE}?a=confirm&t=${encodeURIComponent(token)}`;
