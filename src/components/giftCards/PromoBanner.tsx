import { Gift } from 'lucide-react';
import { isWithinWindow, type PromoSettings } from './giftCardOrders';

/** The shop's current voucher promotion, e.g. "Zu jedem Gutscheinkauf ab 70 € …". */
export default function PromoBanner({ settings }: { settings: PromoSettings }) {
  if (!settings.promo_title && !settings.promo_text) return null;
  if (!isWithinWindow(settings.promo_valid_from, settings.promo_valid_until)) return null;

  return (
    <aside className="flex gap-4 rounded-[22px] border border-[#E7D9C8] bg-gradient-to-br from-[#FBF7F1] to-[#F3EADF] p-5 shadow-[0_16px_40px_-34px_rgba(122,90,58,0.6)]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/80 text-[#9C7650] ring-1 ring-[#E7D9C8]">
        <Gift className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        {settings.promo_title && <p className="font-semibold tracking-tight text-[#3A332B]">{settings.promo_title}</p>}
        {settings.promo_text && <p className="mt-1 text-sm leading-6 text-[#6B5A48]">{settings.promo_text}</p>}
      </div>
    </aside>
  );
}
