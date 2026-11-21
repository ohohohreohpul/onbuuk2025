import { adminAccessToken } from '../../../lib/functionAuth';

export interface GbpReview {
  id: string;
  reviewer_name: string | null;
  rating: number;
  comment: string;
  reviewed_at: string | null;
  reply_text: string | null;
  replied_at: string | null;
  reply_source: 'owner' | 'auto' | 'google' | null;
  draft_text: string | null;
  drafted_at: string | null;
  last_error: string | null;
}

export type CtaType = 'BOOK' | 'LEARN_MORE' | 'ORDER' | 'SHOP' | 'SIGN_UP' | 'CALL';
export const CTA_TYPES: CtaType[] = ['BOOK', 'LEARN_MORE', 'ORDER', 'SHOP', 'SIGN_UP', 'CALL'];

export interface GbpPost {
  id: string;
  content: string;
  topic: string | null;
  cta_type: CtaType | null;
  cta_url: string | null;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduled_for: string | null;
  published_at: string | null;
  post_url: string | null;
  last_error: string | null;
  created_at: string;
}

export interface LocalSeoStatus {
  hasLocalSeo: boolean;
  account: { id: string; reviewUrl: string | null; mapsUrl: string | null } | null;
  settings: { autoReplyPositive: boolean; syncHours: boolean; syncServices: boolean };
  sync: { dueAt: string | null; lastSyncedAt: string | null; lastError: string | null };
}

export type PostMode = 'draft' | 'schedule' | 'publish';

export interface PostInput {
  content: string;
  ctaType: CtaType | null;
  ctaUrl: string | null;
  scheduledFor: string | null;
}

/** Local SEO is not on for this shop (plan or rollout list). */
export class LocalSeoUnavailableError extends Error {}

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/local-seo-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await adminAccessToken()}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 402) throw new LocalSeoUnavailableError(data.error ?? 'not available');
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data as T;
}

export const loadLocalSeoStatus = () => call<LocalSeoStatus>('status');
export const loadReviews = () => call<{ reviews: GbpReview[] }>('reviews');
export const refreshReviews = () => call<{ reviews: GbpReview[] }>('refresh_reviews');
export const draftReviewReply = (id: string) => call<{ draft: string }>('draft_reply', { id });
export const sendReviewReply = (id: string, text: string) => call<{ reviews: GbpReview[] }>('send_reply', { id, text });
export const saveLocalSeoSettings = (settings: Partial<LocalSeoStatus['settings']>) => call<LocalSeoStatus>('save_settings', settings);
export const syncProfileNow = () => call<LocalSeoStatus>('sync_now');
export const loadPosts = () => call<{ posts: GbpPost[] }>('posts');
export const draftWeeklyPost = () => call<{ post: GbpPost }>('draft_post');
/** `error` is set when the post was stored but Google refused it; `postId` lets a retry edit that row. */
export const savePost = (id: string | null, mode: PostMode, input: PostInput) =>
  call<{ posts: GbpPost[]; postId: string; error?: string }>('save_post', { ...(id ? { id } : {}), mode, ...input });
export const deletePost = (id: string) => call<{ posts: GbpPost[] }>('delete_post', { id });

export type ReviewStatus = 'replied' | 'auto' | 'draft' | 'failed' | 'open';

export function reviewStatus(review: GbpReview): ReviewStatus {
  if (review.reply_text) return review.reply_source === 'auto' ? 'auto' : 'replied';
  if (review.last_error) return 'failed';
  if (review.draft_text) return 'draft';
  return 'open';
}

export const starsLabel = (rating: number): string => {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
};

/** Google shows a post for about 7 days; after that it no longer appears on the profile. */
const POST_VISIBLE_DAYS = 7;
const DAY_MS = 86_400_000;

export type PostDisplayStatus = 'draft' | 'scheduled' | 'published' | 'faded' | 'failed';

/** When the post went (or goes) live on Google. */
export const postLiveAt = (post: GbpPost): string | null => post.published_at ?? (post.status === 'scheduled' ? post.scheduled_for : null);

export function postStatus(post: GbpPost, now: Date): PostDisplayStatus {
  const liveAt = postLiveAt(post);
  const isLive = post.status === 'published' || (post.status === 'scheduled' && liveAt !== null && Date.parse(liveAt) <= now.getTime());
  if (!isLive) return post.status;
  const at = liveAt ? Date.parse(liveAt) : NaN;
  return Number.isFinite(at) && now.getTime() - at > POST_VISIBLE_DAYS * DAY_MS ? 'faded' : 'published';
}

/** "YYYY-MM-DDTHH:MM" in the browser's time zone, for <input type="datetime-local">. */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
