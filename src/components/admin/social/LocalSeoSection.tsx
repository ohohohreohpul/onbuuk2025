import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, MapPin, PenLine, RefreshCw, Settings, Sparkles } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText } from '../../../lib/bookingLanguage';
import { ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_STATUS_PILL, ADMIN_SURFACE, ADMIN_TERTIARY_BUTTON } from '../adminUi';
import { LOCAL_SEO_TEXT } from './localSeoText';
import {
  draftWeeklyPost, loadLocalSeoStatus, loadPosts, loadReviews, postStatus, refreshReviews, reviewStatus, starsLabel,
  postLiveAt, type GbpPost, type GbpReview, type LocalSeoStatus, type PostDisplayStatus, type ReviewStatus,
} from './localSeoApi';
import ReviewModal from './ReviewModal';
import PostModal from './PostModal';
import LocalSeoSettingsModal from './LocalSeoSettingsModal';

const NEW_POST = 'new';
const DAY_MS = 86_400_000;

const REVIEW_PILL: Record<ReviewStatus, string> = {
  open: 'bg-amber-50 text-amber-800', draft: 'bg-sky-50 text-sky-800', failed: 'bg-red-50 text-red-700',
  replied: 'bg-emerald-50 text-emerald-700', auto: 'bg-emerald-50 text-emerald-700',
};
const POST_PILL: Record<PostDisplayStatus, string> = {
  draft: 'bg-stone-100 text-stone-600', scheduled: 'bg-sky-50 text-sky-800', published: 'bg-emerald-50 text-emerald-700',
  faded: 'bg-stone-100 text-stone-500', failed: 'bg-red-50 text-red-700',
};

interface LocalSeoSectionProps {
  isConnected: boolean;
  isConnecting: boolean;
  bookingUrl: string;
  onConnect: () => void;
}

/** Google Business Profile inside Zenno Social: reviews inbox, weekly posts, profile sync settings. */
export default function LocalSeoSection({ isConnected, isConnecting, bookingUrl, onConnect }: LocalSeoSectionProps) {
  const { t, locale } = useAdminText(LOCAL_SEO_TEXT);
  const [status, setStatus] = useState<LocalSeoStatus | null>(null);
  const [reviews, setReviews] = useState<GbpReview[]>([]);
  const [posts, setPosts] = useState<GbpPost[]>([]);
  const [openReviewId, setOpenReviewId] = useState<string | null>(null);
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [busy, setBusy] = useState<'refresh' | 'draft' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: 'refresh' | 'draft', action: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : String(actionError));
    } finally {
      setBusy(null);
    }
  };

  const load = useCallback(async () => {
    if (!isConnected) return;
    try {
      const [nextStatus, stored, storedPosts] = await Promise.all([loadLocalSeoStatus(), loadReviews(), loadPosts()]);
      setStatus(nextStatus);
      setReviews(stored.reviews);
      setPosts(storedPosts.posts);
      // First visit after connecting: nothing mirrored yet, so pull from Google once.
      if (stored.reviews.length === 0) setReviews((await refreshReviews()).reviews);
    } catch (loadError) {
      console.error('Could not load Google profile:', loadError);
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }, [isConnected]);

  useEffect(() => { load(); }, [load]);

  const header = (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[#1A1714]"><MapPin className="h-5 w-5 text-stone-400" strokeWidth={1.5} />{t.googleTitle}</h2>
        <p className="mt-0.5 max-w-xl text-sm text-stone-500">{t.googleHint}</p>
      </div>
      {isConnected ? (
        <span className="flex flex-wrap gap-2">
          {status?.account?.reviewUrl && (
            <a href={status.account.reviewUrl} target="_blank" rel="noreferrer" className={ADMIN_TERTIARY_BUTTON}><ExternalLink className="h-4 w-4" /> {t.openReviewLink}</a>
          )}
          {status && <button type="button" onClick={() => setIsSettingsOpen(true)} className={ADMIN_SECONDARY_BUTTON}><Settings className="h-4 w-4" /> {t.settings}</button>}
        </span>
      ) : (
        <button type="button" disabled={isConnecting} onClick={onConnect} className={ADMIN_SECONDARY_BUTTON}>
          {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />} {t.connectGoogle}
        </button>
      )}
    </div>
  );

  if (!isConnected) {
    return (
      <section className="space-y-3">
        {header}
        <p className={`${ADMIN_SURFACE} px-5 py-8 text-center text-sm text-stone-500`}>{t.notConnected}</p>
      </section>
    );
  }

  const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '');
  const reviewLabel: Record<ReviewStatus, string> = { open: t.statusOpen, draft: t.statusDraft, replied: t.statusReplied, auto: t.statusAuto, failed: t.statusFailed };
  const postLabel: Record<PostDisplayStatus, string> = {
    draft: t.postStatusDraft, scheduled: t.postStatusScheduled, published: t.postStatusPublished, faded: t.postStatusFaded, failed: t.postStatusFailed,
  };
  const now = new Date();
  const lastLive = posts.map(postLiveAt).filter((at): at is string => at !== null && Date.parse(at) <= now.getTime()).sort().reverse()[0] ?? null;
  const daysSincePost = lastLive ? Math.floor((now.getTime() - Date.parse(lastLive)) / DAY_MS) : null;
  const openReview = reviews.find((r) => r.id === openReviewId) ?? null;
  const openPost = openPostId === NEW_POST ? null : posts.find((p) => p.id === openPostId) ?? null;

  return (
    <section className="space-y-5">
      {header}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1A1714]">{t.reviewsTitle}</h3>
            <p className="mt-0.5 text-sm text-stone-500">{t.reviewsHint}</p>
          </div>
          <button type="button" disabled={busy !== null} onClick={() => run('refresh', async () => setReviews((await refreshReviews()).reviews))} className={ADMIN_TERTIARY_BUTTON}>
            <RefreshCw className={`h-4 w-4 ${busy === 'refresh' ? 'animate-spin' : ''}`} /> {busy === 'refresh' ? t.refreshing : t.refresh}
          </button>
        </div>
        <ul className={`${ADMIN_SURFACE} divide-y divide-stone-200/70`}>
          {reviews.length === 0 && <li className="px-5 py-8 text-center text-sm text-stone-500">{t.noReviews}</li>}
          {reviews.map((review) => {
            const state = reviewStatus(review);
            return (
              <li key={review.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm tracking-wide text-amber-500" aria-label={`${review.rating}/5`}>{starsLabel(review.rating)}</span>
                    <span className="truncate text-[15px] font-semibold text-[#1A1714]">{review.reviewer_name ?? 'Google'}</span>
                    <span className={`${ADMIN_STATUS_PILL} ${REVIEW_PILL[state]}`}>{reviewLabel[state]}</span>
                  </span>
                  <span className="mt-1 block truncate text-sm text-stone-500">
                    {formatDate(review.reviewed_at)}{review.comment ? ` · ${review.comment}` : ''}
                  </span>
                </span>
                <button type="button" onClick={() => setOpenReviewId(review.id)} className={`${ADMIN_SECONDARY_BUTTON} shrink-0`}>
                  {state === 'replied' || state === 'auto' ? t.view : t.reply}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1A1714]">{t.postsTitle}</h3>
            <p className="mt-0.5 max-w-xl text-sm text-stone-500">{t.postsHint}</p>
            <p className={`mt-1 text-xs font-medium ${daysSincePost === null || daysSincePost >= 7 ? 'text-amber-700' : 'text-stone-500'}`}>
              {daysSincePost === null || daysSincePost >= 7 ? t.noPostYet : fillText(t.lastPostDays, { days: Math.max(0, daysSincePost) })}
            </p>
          </div>
          <span className="flex gap-2">
            <button type="button" onClick={() => setOpenPostId(NEW_POST)} className={ADMIN_SECONDARY_BUTTON}><PenLine className="h-4 w-4" /> {t.newPost}</button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run('draft', async () => {
                const { post } = await draftWeeklyPost();
                setPosts((current) => [post, ...current]);
                setOpenPostId(post.id);
              })}
              className={ADMIN_PRIMARY_BUTTON}
            >
              {busy === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {t.draftPost}
            </button>
          </span>
        </div>
        <ul className={`${ADMIN_SURFACE} divide-y divide-stone-200/70`}>
          {posts.length === 0 && <li className="px-5 py-8 text-center text-sm text-stone-500">{t.noPosts}</li>}
          {posts.map((post) => {
            const state = postStatus(post, now);
            return (
              <li key={post.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className={`${ADMIN_STATUS_PILL} ${POST_PILL[state]}`}>{postLabel[state]}</span>
                    <span className="text-xs text-stone-500">{formatDate(post.published_at ?? post.scheduled_for ?? post.created_at)}</span>
                  </span>
                  <span className="mt-1 block truncate text-sm text-[#1A1714]">{post.content}</span>
                </span>
                <button type="button" onClick={() => setOpenPostId(post.id)} className={`${ADMIN_SECONDARY_BUTTON} shrink-0`}>{t.edit}</button>
              </li>
            );
          })}
        </ul>
      </div>

      {openReview && (
        <ReviewModal
          review={openReview}
          onClose={() => setOpenReviewId(null)}
          onReplied={(next) => { setReviews(next); setOpenReviewId(null); }}
          onDrafted={(id, draft) => setReviews((current) => current.map((r) => (r.id === id ? { ...r, draft_text: draft } : r)))}
        />
      )}
      {openPostId && (
        <PostModal
          post={openPost}
          bookingUrl={bookingUrl}
          isLive={openPost !== null && ['published', 'faded'].includes(postStatus(openPost, now))}
          // Closing after a refused publish: the stored (failed) post should show up in the list.
          onClose={() => { setOpenPostId(null); loadPosts().then(({ posts: next }) => setPosts(next)).catch(() => undefined); }}
          onSaved={(next) => { setPosts(next); setOpenPostId(null); }}
        />
      )}
      {isSettingsOpen && status && (
        <LocalSeoSettingsModal status={status} onClose={() => setIsSettingsOpen(false)} onChanged={setStatus} />
      )}
    </section>
  );
}
