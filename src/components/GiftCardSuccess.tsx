import { useState, useEffect } from 'react';
import { Check, Gift, Mail, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { downloadGiftCardPDF } from '../lib/giftCardPdfGenerator';

export default function GiftCardSuccess() {
  const [loading, setLoading] = useState(true);
  const [giftCard, setGiftCard] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [giftCardSettings, setGiftCardSettings] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    fetchGiftCardDetails();
  }, []);

  const fetchGiftCardDetails = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session_id');
      const giftCardId = params.get('gift_card_id');

      let giftCardData = null;

      if (giftCardId) {
        // Legacy flow: fetch by gift card ID
        const { data, error } = await supabase
          .from('gift_cards')
          .select('*')
          .eq('id', giftCardId)
          .maybeSingle();

        if (error || !data) {
          setError('Gift card not found');
          setLoading(false);
          return;
        }
        giftCardData = data;
      } else if (sessionId) {
        // New flow: fetch by session ID
        // Wait a moment for webhook to process
        await new Promise(resolve => setTimeout(resolve, 2000));

        const { data, error } = await supabase
          .from('gift_cards')
          .select('*')
          .eq('stripe_session_id', sessionId)
          .maybeSingle();

        if (error || !data) {
          // Try one more time after a longer wait
          await new Promise(resolve => setTimeout(resolve, 3000));

          const { data: retryData, error: retryError } = await supabase
            .from('gift_cards')
            .select('*')
            .eq('stripe_session_id', sessionId)
            .maybeSingle();

          if (retryError || !retryData) {
            // Webhook didn't process in time, try manual processing
            console.log('Webhook delayed, attempting manual gift card creation...');

            try {
              const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-gift-card-session`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ sessionId }),
                }
              );

              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to process gift card');
              }

              // Try fetching the gift card one more time
              const { data: finalData, error: finalError } = await supabase
                .from('gift_cards')
                .select('*')
                .eq('stripe_session_id', sessionId)
                .maybeSingle();

              if (finalError || !finalData) {
                throw new Error('Gift card created but could not be retrieved');
              }

              giftCardData = finalData;
            } catch (err: any) {
              console.error('Error processing gift card:', err);
              setError('Gift card is being processed. Please check your email for the gift card details.');
              setLoading(false);
              return;
            }
          } else {
            giftCardData = retryData;
          }
        } else {
          giftCardData = data;
        }
      } else {
        setError('Missing gift card information');
        setLoading(false);
        return;
      }

      setGiftCard(giftCardData);

      // Fetch business details for PDF generation
      const { data: businessData } = await supabase
        .from('businesses')
        .select('name, currency_code, currency_symbol')
        .eq('id', giftCardData.business_id)
        .maybeSingle();

      if (businessData) {
        setBusiness(businessData);
      }

      // Fetch gift card settings for PDF generation
      const { data: settings } = await supabase
        .from('gift_card_settings')
        .select('*')
        .eq('business_id', giftCardData.business_id)
        .maybeSingle();

      if (settings) {
        setGiftCardSettings(settings);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching gift card details:', err);
      setError('Failed to load gift card details');
      setLoading(false);
    }
  };

  const formatPrice = (cents: number) => {
    const symbol = business?.currency_symbol || '€';
    return `${symbol}${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleDownloadPDF = async () => {
    if (!giftCard || !business) return;

    try {
      setDownloadingPdf(true);
      await downloadGiftCardPDF({
        code: giftCard.code,
        amount: giftCard.original_value_cents / 100,
        designUrl: giftCardSettings?.design_url || null,
        termsAndConditions: giftCardSettings?.terms_and_conditions || null,
        businessName: business.name,
        expiresAt: giftCard.expires_at,
        currencySymbol: business.currency_symbol || '€',
      });
    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert('Failed to download PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !giftCard) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <span className="text-2xl">❌</span>
          </div>
          <h1 className="text-2xl font-light text-stone-800 mb-2">
            Unable to Load Gift Card
          </h1>
          <p className="text-stone-600 mb-6">{error || 'Something went wrong'}</p>
          <button
            onClick={() => (window.location.href = '/')}
            className="px-6 py-3 bg-stone-800 text-white hover:bg-stone-700 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white p-8 md:p-12">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl md:text-4xl font-light text-stone-800 mb-3">
            Gift Card Purchased!
          </h1>
          <p className="text-stone-600 leading-relaxed">
            Your payment has been processed successfully.
            {giftCard.purchased_for_email && (
              <>
                {' '}We've sent the gift card details to{' '}
                <span className="font-medium">{giftCard.purchased_for_email}</span>
              </>
            )}
          </p>
        </div>

        <div className="border border-stone-200 p-6 md:p-8 mb-8 bg-gradient-to-br from-stone-50 to-stone-100">
          <div className="flex items-center justify-center mb-6">
            <Gift className="w-16 h-16 text-stone-700" />
          </div>

          <h2 className="text-center text-2xl font-light text-stone-800 mb-2">
            Gift Card
          </h2>
          <p className="text-center text-3xl font-medium text-stone-900 mb-6">
            {formatPrice(giftCard.original_value_cents)}
          </p>

          <div className="space-y-4 bg-white p-6 rounded-lg border border-stone-200">
            <div className="flex justify-between items-center pb-3 border-b border-stone-200">
              <span className="text-sm text-stone-600">Gift Card Code:</span>
              <span className="text-lg font-mono font-medium text-stone-900">
                {giftCard.code}
              </span>
            </div>

            <div className="flex justify-between items-center pb-3 border-b border-stone-200">
              <span className="text-sm text-stone-600">Balance:</span>
              <span className="text-stone-900 font-medium">
                {formatPrice(giftCard.current_balance_cents)}
              </span>
            </div>

            {giftCard.purchased_for_email && (
              <div className="flex justify-between items-center pb-3 border-b border-stone-200">
                <span className="text-sm text-stone-600">Recipient Email:</span>
                <span className="text-stone-900 font-medium">
                  {giftCard.purchased_for_email}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center pb-3 border-b border-stone-200">
              <span className="text-sm text-stone-600">Purchased On:</span>
              <span className="text-stone-900 font-medium">
                {formatDate(giftCard.purchased_at)}
              </span>
            </div>

            {giftCard.expires_at && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-stone-600">Valid Until:</span>
                <span className="text-stone-900 font-medium">
                  {formatDate(giftCard.expires_at)}
                </span>
              </div>
            )}
          </div>
        </div>

        {giftCard.purchased_for_email && (
          <div className="mb-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-stone-800 mb-1">Email Notification</h3>
                <p className="text-sm text-stone-600 leading-relaxed">
                  The recipient will receive an email with the gift card details and redemption instructions.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <button
            onClick={handleDownloadPDF}
            disabled={downloadingPdf}
            className="w-full px-6 py-4 bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
          >
            <Download className="w-5 h-5" />
            {downloadingPdf ? 'Generating PDF...' : 'Download Gift Card PDF'}
          </button>
          <p className="text-xs text-stone-500 text-center mt-2">
            Download a printable PDF version of the gift card
          </p>
        </div>

        <div className="text-center space-y-4">
          <button
            onClick={() => (window.location.href = '/')}
            className="w-full md:w-auto px-8 py-3 bg-stone-800 text-white hover:bg-stone-700 transition-colors"
          >
            Return to Home
          </button>
          <p className="text-sm text-stone-500">
            Need help?{' '}
            <a href="/contact" className="text-stone-700 hover:underline">
              Contact us
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
