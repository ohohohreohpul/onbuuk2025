import { useState } from 'react';
import { ChevronRight, Gift, X, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../lib/tenantContext';

interface AppliedGiftCard {
  id: string;
  code: string;
  amountUsedCents: number;
  remainingBalanceCents: number;
}

interface GiftCardRedemptionStepProps {
  totalAmountCents: number;
  onNext: (appliedGiftCards: AppliedGiftCard[]) => void;
  onBack: () => void;
}

export default function GiftCardRedemptionStep({
  totalAmountCents,
  onNext,
  onBack,
}: GiftCardRedemptionStepProps) {
  const { businessId } = useTenant();
  const [giftCardCode, setGiftCardCode] = useState('');
  const [appliedGiftCards, setAppliedGiftCards] = useState<AppliedGiftCard[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatPrice = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const getTotalGiftCardAmount = () => {
    return appliedGiftCards.reduce((sum, card) => sum + card.amountUsedCents, 0);
  };

  const getRemainingAmount = () => {
    return Math.max(0, totalAmountCents - getTotalGiftCardAmount());
  };

  const handleApplyGiftCard = async () => {
    if (!giftCardCode.trim()) {
      setError('Please enter a gift card code');
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const cleanCode = giftCardCode.trim().toUpperCase();

      const { data: giftCard, error: fetchError } = await supabase
        .from('gift_cards')
        .select('*')
        .eq('business_id', businessId)
        .eq('code', cleanCode)
        .maybeSingle();

      if (fetchError || !giftCard) {
        setError('Invalid gift card code');
        setIsValidating(false);
        return;
      }

      if (giftCard.status !== 'active') {
        setError('This gift card is no longer active');
        setIsValidating(false);
        return;
      }

      if (giftCard.expires_at && new Date(giftCard.expires_at) < new Date()) {
        setError('This gift card has expired');
        setIsValidating(false);
        return;
      }

      if (giftCard.current_balance_cents <= 0) {
        setError('This gift card has no remaining balance');
        setIsValidating(false);
        return;
      }

      if (appliedGiftCards.some((card) => card.id === giftCard.id)) {
        setError('This gift card has already been applied');
        setIsValidating(false);
        return;
      }

      const remainingToPay = getRemainingAmount();
      if (remainingToPay <= 0) {
        setError('Your booking is already fully covered by gift cards');
        setIsValidating(false);
        return;
      }

      const amountToUse = Math.min(giftCard.current_balance_cents, remainingToPay);

      const newCard: AppliedGiftCard = {
        id: giftCard.id,
        code: giftCard.code,
        amountUsedCents: amountToUse,
        remainingBalanceCents: giftCard.current_balance_cents - amountToUse,
      };

      setAppliedGiftCards([...appliedGiftCards, newCard]);
      setGiftCardCode('');
      setError(null);
    } catch (err) {
      console.error('Error validating gift card:', err);
      setError('Failed to validate gift card. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveGiftCard = (cardId: string) => {
    setAppliedGiftCards(appliedGiftCards.filter((card) => card.id !== cardId));
  };

  const handleSkip = () => {
    onNext([]);
  };

  const handleContinue = () => {
    onNext(appliedGiftCards);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleApplyGiftCard();
    }
  };

  return (
    <div className="h-full flex flex-col max-h-full">
      <div className="flex-shrink-0 mb-4">
        <button
          onClick={onBack}
          className="text-stone-500 hover:text-stone-700 text-sm mb-4 inline-flex items-center"
        >
          <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
          Back
        </button>
        <h2 className="text-3xl font-light text-stone-800 mb-2">Gift Card</h2>
        <p className="text-stone-600">Apply a gift card to your booking (optional)</p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-6 mb-4">
        <div className="border border-stone-200 p-6 bg-stone-50">
          <div className="flex items-center space-x-3 mb-4">
            <Gift className="w-5 h-5 text-stone-600" />
            <h3 className="text-sm font-medium text-stone-700">Apply Gift Card</h3>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="giftCardCode" className="block text-sm text-stone-600 mb-2">
                Gift Card Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="giftCardCode"
                  value={giftCardCode}
                  onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())}
                  onKeyPress={handleKeyPress}
                  placeholder="GC-XXXX-XXXX-XXXX"
                  className="flex-1 px-4 py-2 border border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-400 text-stone-800"
                  disabled={isValidating}
                />
                <button
                  onClick={handleApplyGiftCard}
                  disabled={isValidating || !giftCardCode.trim()}
                  className="px-6 py-2 bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:bg-stone-400 disabled:cursor-not-allowed"
                >
                  {isValidating ? 'Validating...' : 'Apply'}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>
        </div>

        {appliedGiftCards.length > 0 && (
          <div className="border border-stone-200 p-6 space-y-4">
            <h3 className="text-sm font-medium text-stone-700 uppercase tracking-wider">
              Applied Gift Cards
            </h3>

            <div className="space-y-3">
              {appliedGiftCards.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Check className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-800">{card.code}</p>
                      <p className="text-xs text-stone-600">
                        Applied: {formatPrice(card.amountUsedCents)}
                        {card.remainingBalanceCents > 0 && (
                          <> · Remaining: {formatPrice(card.remainingBalanceCents)}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveGiftCard(card.id)}
                    className="p-2 text-stone-500 hover:text-red-600 transition-colors"
                    title="Remove gift card"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border border-stone-200 p-6 bg-stone-50">
          <h3 className="text-sm font-medium text-stone-700 uppercase tracking-wider mb-4">
            Payment Summary
          </h3>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-600">Original Total:</span>
              <span className="text-stone-800 font-medium">{formatPrice(totalAmountCents)}</span>
            </div>

            {appliedGiftCards.length > 0 && (
              <>
                <div className="flex justify-between text-green-600">
                  <span>Gift Card Discount:</span>
                  <span className="font-medium">-{formatPrice(getTotalGiftCardAmount())}</span>
                </div>
                <div className="pt-3 mt-3 border-t border-stone-200">
                  <div className="flex justify-between items-center">
                    <span className="text-stone-800 font-medium">Remaining to Pay:</span>
                    <span className="text-xl font-medium text-stone-800">
                      {formatPrice(getRemainingAmount())}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <h4 className="text-sm font-medium text-stone-800 mb-2">About Gift Cards</h4>
          <ul className="text-xs text-stone-600 space-y-1 leading-relaxed">
            <li>• Gift cards can cover part or all of your booking</li>
            <li>• You can apply multiple gift cards to one booking</li>
            <li>• Unused balance remains on your gift card for future use</li>
            <li>• This step is optional - you can skip if you don't have a gift card</li>
          </ul>
        </div>
      </div>

      <div className="flex-shrink-0 space-y-3">
        <button
          onClick={handleContinue}
          className="w-full px-8 py-4 bg-stone-800 text-white text-sm tracking-wide hover:bg-stone-700 transition-colors duration-200"
        >
          {appliedGiftCards.length > 0
            ? getRemainingAmount() === 0
              ? 'Complete Booking'
              : `Continue to Payment ${formatPrice(getRemainingAmount())}`
            : 'Continue without Gift Card'}
          <ChevronRight className="inline w-4 h-4 ml-2" />
        </button>

        {appliedGiftCards.length === 0 && (
          <button
            onClick={handleSkip}
            className="w-full px-8 py-3 text-stone-600 hover:text-stone-800 text-sm transition-colors"
          >
            Skip this step
          </button>
        )}
      </div>
    </div>
  );
}
