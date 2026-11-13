import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText } from '../../../lib/bookingLanguage';
import {
  ADMIN_INPUT, ADMIN_MODAL, ADMIN_MODAL_BACKDROP, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_SELECT, ADMIN_TERTIARY_BUTTON,
} from '../adminUi';
import { LOCAL_SEO_TEXT } from './localSeoText';
import { CTA_TYPES, deletePost, savePost, toLocalInput, type CtaType, type GbpPost, type PostMode } from './localSeoApi';

const MAX_POST = 1500;

interface PostModalProps {
  post: GbpPost | null;
  /** Already on Google (published, or its scheduled time has passed): read-only. */
  isLive: boolean;
  bookingUrl: string;
  onClose: () => void;
  onSaved: (posts: GbpPost[]) => void;
}

/** "Edit" popup for one Google post: text, button, date; save as draft, schedule or publish. */
export default function PostModal({ post, isLive, bookingUrl, onClose, onSaved }: PostModalProps) {
  const { t } = useAdminText(LOCAL_SEO_TEXT);
  const [content, setContent] = useState(post?.content ?? '');
  const [ctaType, setCtaType] = useState<CtaType | ''>(post ? post.cta_type ?? '' : bookingUrl ? 'BOOK' : '');
  const [ctaUrl, setCtaUrl] = useState(post?.cta_url ?? bookingUrl);
  const [when, setWhen] = useState(post?.scheduled_for ? toLocalInput(new Date(post.scheduled_for)) : '');
  const [busy, setBusy] = useState<PostMode | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(post?.last_error ?? null);
  // A new post that Google refused is stored; retries must edit that row, not create another.
  const [postId, setPostId] = useState<string | null>(post?.id ?? null);

  const run = async (kind: PostMode | 'delete', action: () => Promise<{ posts: GbpPost[] }>) => {
    setBusy(kind);
    setError(null);
    try {
      onSaved((await action()).posts);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : String(actionError));
      setBusy(null);
    }
  };

  const save = async (mode: PostMode) => {
    setBusy(mode);
    setError(null);
    try {
      const result = await savePost(postId, mode, {
        content,
        ctaType: ctaType || null,
        ctaUrl: ctaType && ctaType !== 'CALL' ? ctaUrl : null,
        scheduledFor: mode === 'schedule' && when ? new Date(when).toISOString() : null,
      });
      setPostId(result.postId);
      if (result.error) {
        setError(result.error);
        setBusy(null);
        return;
      }
      onSaved(result.posts);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
      setBusy(null);
    }
  };
  const remove = () => {
    if (postId && confirm(t.confirmDelete)) run('delete', () => deletePost(postId));
  };

  return (
    <div className={ADMIN_MODAL_BACKDROP} role="dialog" aria-modal="true" aria-labelledby="post-title">
      <div className={`${ADMIN_MODAL} max-h-[90vh] max-w-xl overflow-y-auto p-6`}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="post-title" className="text-lg font-semibold text-[#1A1714]">{post?.topic ?? t.postTitle}</h2>
          <button type="button" onClick={onClose} aria-label={t.close} className={ADMIN_TERTIARY_BUTTON}><X className="h-4 w-4" /></button>
        </div>
        {isLive && <p className="mb-4 rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-600">{t.publishedReadOnly}</p>}
        <fieldset disabled={isLive || busy !== null} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-stone-700">
              {t.postText}
              <span className="text-xs font-normal text-stone-400">{fillText(t.chars, { count: content.length, max: MAX_POST })}</span>
            </span>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={7} maxLength={MAX_POST} className={`${ADMIN_INPUT} resize-none`} />
            <span className="mt-1 block text-xs text-stone-500">{t.postTextHint}</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <label className="block"><span className="mb-1.5 block text-sm font-medium text-stone-700">{t.button}</span>
              <select value={ctaType} onChange={(e) => setCtaType(e.target.value as CtaType | '')} className={ADMIN_SELECT}>
                <option value="">{t.noButton}</option>
                {CTA_TYPES.map((type) => <option key={type} value={type}>{t[`cta${type}`]}</option>)}
              </select>
            </label>
            {ctaType && ctaType !== 'CALL' && (
              <label className="block"><span className="mb-1.5 block text-sm font-medium text-stone-700">{t.buttonLink}</span>
                <input type="url" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://" className={ADMIN_INPUT} />
              </label>
            )}
          </div>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-stone-700">{t.when}</span>
            <input type="datetime-local" value={when} min={toLocalInput(new Date())} onChange={(e) => setWhen(e.target.value)} className={ADMIN_INPUT} />
            <span className="mt-1 block text-xs text-stone-500">{t.whenHint}</span>
          </label>
        </fieldset>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {postId && !isLive
            ? <button type="button" onClick={remove} disabled={busy !== null} className={`${ADMIN_TERTIARY_BUTTON} text-red-700 hover:bg-red-50`}>
                <Trash2 className="h-4 w-4" /> {post?.status === 'scheduled' ? t.cancelPost : t.deletePost}
              </button>
            : <span />}
          {isLive ? (
            <button type="button" onClick={onClose} className={ADMIN_SECONDARY_BUTTON}>{t.close}</button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => save('draft')} disabled={busy !== null} className={ADMIN_SECONDARY_BUTTON}>{busy === 'draft' ? t.saving : t.saveDraft}</button>
              {when
                ? <button type="button" onClick={() => save('schedule')} disabled={busy !== null} className={ADMIN_PRIMARY_BUTTON}>{busy === 'schedule' ? t.saving : t.schedule}</button>
                : <button type="button" onClick={() => save('publish')} disabled={busy !== null} className={ADMIN_PRIMARY_BUTTON}>{busy === 'publish' ? t.saving : t.publishNow}</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
