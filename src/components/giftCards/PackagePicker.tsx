import { Check, Gift, Sparkles } from 'lucide-react';
import { useCurrency } from '../../lib/currencyContext';
import { useBookingText, fillText, type Translations } from '../../lib/bookingLanguage';
import { isSoldOut, packageStandardValue, type GiftCardPackage } from './giftCardOrders';

const TEXT: Translations<{
  title: string;
  hint: string;
  instead: string;
  soldOut: string;
  until: string;
  minutes: string;
}> = {
  en: {
    title: 'Choose a voucher set',
    hint: 'Each voucher in the set has its own code and can be redeemed separately.',
    instead: 'instead of {amount}',
    soldOut: 'Sold out',
    until: 'Offer until {date}',
    minutes: '{minutes} min',
  },
  de: {
    title: 'Gutscheinset wählen',
    hint: 'Jeder Gutschein im Set hat einen eigenen Code und ist einzeln einlösbar.',
    instead: 'statt {amount}',
    soldOut: 'Ausverkauft',
    until: 'Angebot bis {date}',
    minutes: '{minutes} Min.',
  },
};

interface PackagePickerProps {
  packages: GiftCardPackage[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function PackagePicker({ packages, selectedId, onSelect }: PackagePickerProps) {
  const { formatAmount } = useCurrency();
  const { t, locale } = useBookingText(TEXT);

  const lastDay = (until: string) => {
    // valid_until is the first moment after the offer; show the last included day.
    const date = new Date(new Date(until).getTime() - 1);
    return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <section aria-labelledby="gift-packages-title" className="space-y-3">
      <div>
        <h2 id="gift-packages-title" className="text-sm font-semibold text-stone-800">{t.title}</h2>
        <p className="mt-1 text-xs text-stone-500">{t.hint}</p>
      </div>
      <div className="grid gap-4">
        {packages.map((pkg) => {
          const isSelected = pkg.id === selectedId;
          const soldOut = isSoldOut(pkg);
          const compareAt = pkg.compare_at_cents ?? packageStandardValue(pkg);
          return (
            <button
              key={pkg.id}
              type="button"
              disabled={soldOut}
              aria-pressed={isSelected}
              onClick={() => onSelect(pkg.id)}
              className={`group w-full overflow-hidden rounded-[22px] border text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                isSelected
                  ? 'border-[#1A1714] shadow-[0_22px_50px_-28px_rgba(26,23,20,0.55)] ring-2 ring-[#1A1714]'
                  : 'border-white/90 bg-white/[0.7] shadow-[0_16px_42px_-36px_rgba(28,25,23,0.55)] backdrop-blur-xl hover:border-stone-300'
              }`}
            >
              <div className="bg-white/80 p-4 sm:p-5">
                <div className="flex items-start gap-4">
                  {pkg.cover_url && (
                    <img
                      src={pkg.cover_url}
                      alt=""
                      width={1050}
                      height={1480}
                      loading="lazy"
                      className="aspect-[1050/1480] w-16 shrink-0 rounded-lg object-cover shadow-[0_6px_18px_-8px_rgba(26,23,20,0.45)] sm:w-20"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold leading-snug tracking-tight text-stone-900">{pkg.name}</p>
                        {pkg.subtitle && <p className="mt-0.5 text-xs font-medium text-[#9C7650]">{pkg.subtitle}</p>}
                      </div>
                      <div className="flex items-baseline gap-2 sm:block sm:shrink-0 sm:text-right">
                        <p className="text-xl font-semibold tracking-tight text-stone-900">{formatAmount(pkg.price_cents / 100)}</p>
                        {compareAt > pkg.price_cents && (
                          <p className="text-xs text-stone-400 line-through decoration-stone-300">
                            {fillText(t.instead, { amount: formatAmount(compareAt / 100) })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <ul className="mt-4 space-y-1.5 text-sm text-stone-600">
                  {pkg.gift_card_package_items.map((item) => (
                    <li key={item.id} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#9C7650]" aria-hidden="true" />
                      <span>
                        <span className="font-medium text-stone-800">{item.quantity}×</span>{' '}
                        {item.label ?? item.services?.name}
                      </span>
                    </li>
                  ))}
                </ul>

                {pkg.description && <p className="mt-3 text-xs leading-5 text-stone-500">{pkg.description}</p>}

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  {pkg.bonus_note && (
                    <span className="inline-flex items-start gap-1.5 rounded-2xl bg-[#F3EADF] px-3 py-1.5 font-medium leading-5 text-[#7A5A3A]">
                      <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {pkg.bonus_note}
                    </span>
                  )}
                  {soldOut && <span className="rounded-full bg-stone-200 px-3 py-1 font-medium text-stone-600">{t.soldOut}</span>}
                  {pkg.valid_until && !soldOut && (
                    <span className="inline-flex items-center gap-1 text-stone-400">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {fillText(t.until, { date: lastDay(pkg.valid_until) })}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
