import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText } from '../../../lib/bookingLanguage';
import { ADMIN_INPUT, ADMIN_MODAL, ADMIN_MODAL_BACKDROP, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_TERTIARY_BUTTON } from '../adminUi';
import { LOCAL_SEO_TEXT } from './localSeoText';
import { draftReviewReply, sendReviewReply, starsLabel, type GbpReview } from './localSeoApi';

const MAX_REPLY = 4096;

interface ReviewModalProps {
  review: GbpReview;
  onClose: () => void;
  /** Called with the refreshed review list after a reply was published. */
  onReplied: (reviews: GbpReview[]) => void;
  /** Called after an AI draft was stored, so the row shows "Draft ready". */
  onDrafted: (id: string, draft: string) => void;
}

/** One Google review: read it, draft a reply with AI (1 credit), edit, publish. */
export default function ReviewModal({ review, onClose, onReplied, onDrafted }: ReviewModalProps) {
  const { t, locale } = useAdminText(LOCAL_SEO_TEXT);
  const [text, setText] = useState(review.draft_text ?? review.reply_text ?? '');
  const [busy, setBusy] = useState<'draft' | 'publish' | null>(null);
  const [error, setError] = useState<string | null>(review.last_error);
  const name = review.reviewer_name ?? 'Google';

  const run = async (kind: 'draft' | 'publish', action: () => Promise<void>) => {
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

  const draft = () => run('draft', async () => {
    const { draft: drafted } = await draftReviewReply(review.id);
    setText(drafted);
    onDrafted(review.id, drafted);
  });
  const publish = () => run('publish', async () => onReplied((await sendReviewReply(review.id, text)).reviews));

  return (
    <div className={ADMIN_MODAL_BACKDROP} role="dialog" aria-modal="true" aria-labelledby="review-title">
      <div className={`${ADMIN_MODAL} max-h-[90vh] max-w-xl overflow-y-auto p-6`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="review-title" className="truncate text-lg font-semibold text-[#1A1714]">{fillText(t.reviewTitle, { name })}</h2>
            <p className="mt-0.5 text-sm text-stone-500">
              <span className="text-amber-500" aria-label={`${review.rating}/5`}>{starsLabel(review.rating)}</span>
              {review.reviewed_at && <> · {new Date(review.reviewed_at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}</>}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={t.close} className={ADMIN_TERTIARY_BUTTON}><X className="h-4 w-4" /></button>
        </div>

        <blockquote className="rounded-xl bg-stone-50 px-4 py-3 text-sm leading-relaxed text-stone-700">
          {review.comment || <span className="italic text-stone-400">{t.noText}</span>}
        </blockquote>

        <label className="mt-5 block">
          <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-stone-700">
            {review.reply_text ? t.replyPublished : t.yourReply}
            <span className="text-xs font-normal text-stone-400">{fillText(t.chars, { count: text.length, max: MAX_REPLY })}</span>
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            maxLength={MAX_REPLY}
            placeholder={t.replyPlaceholder}
            disabled={busy !== null}
            className={`${ADMIN_INPUT} resize-none`}
          />
        </label>
        {review.reply_text && <p className="mt-1.5 text-xs text-stone-500">{t.replyOverwrite}</p>}

        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {!review.reply_text ? (
            <button type="button" onClick={draft} disabled={busy !== null} className={ADMIN_SECONDARY_BUTTON} title={t.aiCost}>
              <Sparkles className="h-4 w-4" /> {busy === 'draft' ? t.drafting : t.draftWithAi}
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={ADMIN_SECONDARY_BUTTON}>{t.cancel}</button>
            <button type="button" onClick={publish} disabled={busy !== null || !text.trim()} className={ADMIN_PRIMARY_BUTTON}>
              {busy === 'publish' ? t.publishing : t.publishReply}
            </button>
          </div>
        </div>
        {!review.reply_text && <p className="mt-2 text-xs text-stone-400">{t.aiCost}</p>}
      </div>
    </div>
  );
}
