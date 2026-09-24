import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { adminAuth } from '../../../lib/adminAuth';
import { RELAUNCH_ANNOUNCEMENT_KEY, RELAUNCH_SLIDES } from './relaunchSlides';

/**
 * One-time "Buuk is now part of ZennoHQ" + what's new walkthrough.
 * Shown once per admin account; the view is recorded in admin_announcement_views.
 */
export default function WhatsNewModal() {
  const adminUserId = adminAuth.getCurrentUser()?.id ?? null;
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const slide = RELAUNCH_SLIDES[index];
  const isLast = index === RELAUNCH_SLIDES.length - 1;

  useEffect(() => {
    if (!adminUserId) return;
    let isCancelled = false;

    supabase
      .from('admin_announcement_views')
      .select('announcement_key')
      .eq('admin_user_id', adminUserId)
      .eq('announcement_key', RELAUNCH_ANNOUNCEMENT_KEY)
      .maybeSingle()
      .then(({ data, error }) => {
        // If we cannot tell, stay quiet rather than risk showing it on every login.
        if (error) {
          console.error('Could not check announcement status:', error);
          return;
        }
        if (!isCancelled && !data) setIsOpen(true);
      });

    return () => {
      isCancelled = true;
    };
  }, [adminUserId]);

  const close = useCallback(async () => {
    setIsOpen(false);
    if (!adminUserId) return;
    const { error } = await supabase
      .from('admin_announcement_views')
      .upsert(
        { admin_user_id: adminUserId, announcement_key: RELAUNCH_ANNOUNCEMENT_KEY },
        { onConflict: 'admin_user_id,announcement_key', ignoreDuplicates: true }
      );
    if (error) console.error('Could not record announcement view:', error);
  }, [adminUserId]);

  const next = useCallback(() => {
    if (isLast) close();
    else setIndex((current) => current + 1);
  }, [isLast, close]);

  const back = useCallback(() => setIndex((current) => Math.max(0, current - 1)), []);

  useEffect(() => {
    if (!isOpen) return;
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') next();
      if (event.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close, next, back]);

  if (!isOpen) return null;

  const Icon = slide.icon;
  const isWelcome = index === 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1A1714]/50 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        tabIndex={-1}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-[#F7F5F2] shadow-[0_24px_80px_rgba(26,23,20,0.35)] outline-none"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className={`absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
            isWelcome ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-stone-400 hover:bg-stone-900/5 hover:text-stone-700'
          }`}
        >
          <X className="h-4 w-4" />
        </button>

        <div className={`relative px-8 pb-8 pt-10 ${isWelcome ? 'bg-[#1A1714] text-white' : ''}`}>
          {isWelcome && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(160,153,144,0.35),transparent_70%)]"
            />
          )}
          <div
            className={`mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${
              isWelcome ? 'bg-white/10 text-white' : 'bg-[#1A1714] text-white'
            }`}
          >
            <Icon className="h-6 w-6" strokeWidth={1.6} />
          </div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${isWelcome ? 'text-white/55' : 'text-stone-400'}`}>
            {slide.eyebrow}
          </p>
          <h2 id="whats-new-title" className={`mt-2 text-[26px] font-semibold leading-tight tracking-tight ${isWelcome ? 'text-white' : 'text-[#1A1714]'}`}>
            {slide.title}
          </h2>
          <p className={`mt-3 text-[15px] leading-relaxed ${isWelcome ? 'text-white/75' : 'text-stone-600'}`}>{slide.body}</p>
        </div>

        {slide.points && (
          <ul className="space-y-2.5 px-8 pt-6">
            {slide.points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-stone-700">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70">
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
                {point}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-4 px-8 pb-7 pt-8">
          <div className="flex items-center gap-1.5" aria-label={`Slide ${index + 1} of ${RELAUNCH_SLIDES.length}`}>
            {RELAUNCH_SLIDES.map((item, dotIndex) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(dotIndex)}
                aria-label={`Go to ${item.title}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${dotIndex === index ? 'w-6 bg-[#1A1714]' : 'w-1.5 bg-stone-300 hover:bg-stone-400'}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {index > 0 ? (
              <button
                type="button"
                onClick={back}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-900/5 hover:text-[#1A1714]"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            ) : (
              <button
                type="button"
                onClick={close}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-stone-500 transition hover:bg-stone-900/5 hover:text-stone-700"
              >
                Skip
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1A1714] px-4 py-2.5 text-sm font-medium text-white shadow-[0_2px_12px_rgba(26,23,20,0.18)] transition hover:bg-[#2E2926] active:translate-y-px"
            >
              {isWelcome ? "See what's new" : isLast ? 'Get started' : 'Next'}
              {!isLast && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
