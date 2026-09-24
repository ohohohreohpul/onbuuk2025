import { useState, useEffect } from 'react';
import { Check, Gift, Mail, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { downloadGiftCardPDF } from '../lib/giftCardPdfGenerator';
import { BRAND_SUPPORT_URL } from '../lib/brand';
import { CURRENCY_SYMBOLS, formatCurrency } from '../lib/currency';
import { useBookingText, fillText, type Translations } from '../lib/bookingLanguage';

const TEXT: Translations<{
  errNotFound: string;
  errRetrieve: string;
  errProcessFallback: string;
  errProcess: string;
  errUnexpected: string;
  errMissing: string;
  errMissingDetail: string;
  errLoad: string;
  businessFallback: string;
  alertNoCard: string;
  alertNoBusiness: string;
  alertPdfFailed: string;
  unableTitle: string;
  somethingWrong: string;
  errorDetails: string;
  sessionIdLabel: string;
  saveSessionId: string;
  retrying: string;
  tryAgain: string;
  paymentOkHint: string;
  contactSupport: string;
  titlePass: string;
  titleValue: string;
  paymentProcessed: string;
  sentToPass: string;
  sentToValue: string;
  sentToSuffix: string;
  cardLabelPass: string;
  cardLabelValue: string;
  passNameFallback: string;
  visitOne: string;
  visitMany: string;
  minutesEach: string;
  codeLabelPass: string;
  codeLabelValue: string;
  visitsRemaining: string;
  balance: string;
  remainingOf: string;
  purchasedFor: string;
  recipientEmail: string;
  purchasedOn: string;
  validUntil: string;
  emailNotification: string;
  recipientInfoPass: string;
  recipientInfoValue: string;
  generatingPdf: string;
  downloadPass: string;
  downloadValue: string;
  pdfHint: string;
  needHelp: string;
  contactUs: string;
}> = {
  en: {
    errNotFound: "Gift card not found",
    errRetrieve: "Gift card created but could not be retrieved. Please check your email or contact support.",
    errProcessFallback: "Failed to process gift card",
    errProcess: "Unable to process your gift card at this time",
    errUnexpected: "An unexpected error occurred while processing your gift card.",
    errMissing: "Missing gift card information",
    errMissingDetail: "No session ID or gift card ID was provided in the URL.",
    errLoad: "Failed to load gift card details",
    businessFallback: "Business",
    alertNoCard: "Gift card data is not available. Please try refreshing the page.",
    alertNoBusiness: "Business information is not available. Please try refreshing the page.",
    alertPdfFailed: "Failed to download PDF. Please try again or contact support if the issue persists.",
    unableTitle: "Unable to Load Gift Card",
    somethingWrong: "Something went wrong",
    errorDetails: "Error Details:",
    sessionIdLabel: "Session ID:",
    saveSessionId: "Save this ID when contacting support",
    retrying: "Retrying...",
    tryAgain: "Try Again",
    paymentOkHint: "Your payment was successful. If you continue to see this error, please check your email for gift card details or contact support.",
    contactSupport: "Contact Support",
    titlePass: "Service Pass Purchased!",
    titleValue: "Gift Card Purchased!",
    paymentProcessed: "Your payment has been processed successfully.",
    sentToPass: "We've sent the pass details to",
    sentToValue: "We've sent the gift card details to",
    sentToSuffix: "",
    cardLabelPass: "Service Pass",
    cardLabelValue: "Gift Card",
    passNameFallback: "Service pass",
    visitOne: "{count} visit",
    visitMany: "{count} visits",
    minutesEach: " · {minutes} minutes each",
    codeLabelPass: "Pass Code:",
    codeLabelValue: "Gift Card Code:",
    visitsRemaining: "Visits remaining:",
    balance: "Balance:",
    remainingOf: "{remaining} of {total}",
    purchasedFor: "Purchased for:",
    recipientEmail: "Recipient Email:",
    purchasedOn: "Purchased On:",
    validUntil: "Valid Until:",
    emailNotification: "Email Notification",
    recipientInfoPass: "The recipient will receive an email with the service-pass details and redemption instructions.",
    recipientInfoValue: "The recipient will receive an email with the gift-card details and redemption instructions.",
    generatingPdf: "Generating PDF...",
    downloadPass: "Download Service Pass PDF",
    downloadValue: "Download Gift Card PDF",
    pdfHint: "Download a printable PDF version of the gift card",
    needHelp: "Need help?",
    contactUs: "Contact us",
  },
  de: {
    errNotFound: "Gutschein nicht gefunden",
    errRetrieve: "Der Gutschein wurde erstellt, konnte aber nicht abgerufen werden. Bitte das E-Mail-Postfach prüfen oder den Support kontaktieren.",
    errProcessFallback: "Der Gutschein konnte nicht verarbeitet werden",
    errProcess: "Der Gutschein kann derzeit nicht verarbeitet werden",
    errUnexpected: "Bei der Verarbeitung des Gutscheins ist ein unerwarteter Fehler aufgetreten.",
    errMissing: "Gutscheininformationen fehlen",
    errMissingDetail: "In der URL wurde weder eine Sitzungs-ID noch eine Gutschein-ID übergeben.",
    errLoad: "Gutscheindetails konnten nicht geladen werden",
    businessFallback: "Unternehmen",
    alertNoCard: "Gutscheindaten sind nicht verfügbar. Bitte die Seite neu laden.",
    alertNoBusiness: "Unternehmensdaten sind nicht verfügbar. Bitte die Seite neu laden.",
    alertPdfFailed: "Das PDF konnte nicht heruntergeladen werden. Bitte erneut versuchen oder bei anhaltenden Problemen den Support kontaktieren.",
    unableTitle: "Gutschein konnte nicht geladen werden",
    somethingWrong: "Etwas ist schiefgelaufen",
    errorDetails: "Fehlerdetails:",
    sessionIdLabel: "Sitzungs-ID:",
    saveSessionId: "Bitte diese ID bei einer Anfrage an den Support angeben",
    retrying: "Neuer Versuch …",
    tryAgain: "Erneut versuchen",
    paymentOkHint: "Die Zahlung war erfolgreich. Wird dieser Fehler weiterhin angezeigt, finden Sie die Gutscheindetails in Ihrem E-Mail-Postfach – oder wenden Sie sich an den Support.",
    contactSupport: "Support kontaktieren",
    titlePass: "Behandlungsgutschein gekauft!",
    titleValue: "Gutschein gekauft!",
    paymentProcessed: "Die Zahlung wurde erfolgreich abgeschlossen.",
    sentToPass: "Die Gutscheindetails wurden an",
    sentToValue: "Die Gutscheindetails wurden an",
    sentToSuffix: " gesendet.",
    cardLabelPass: "Behandlungsgutschein",
    cardLabelValue: "Wertgutschein",
    passNameFallback: "Behandlungsgutschein",
    visitOne: "{count} Besuch",
    visitMany: "{count} Besuche",
    minutesEach: " · je {minutes} Minuten",
    codeLabelPass: "Gutscheincode:",
    codeLabelValue: "Gutscheincode:",
    visitsRemaining: "Verbleibende Besuche:",
    balance: "Guthaben:",
    remainingOf: "{remaining} von {total}",
    purchasedFor: "Kaufpreis:",
    recipientEmail: "E-Mail des Empfängers:",
    purchasedOn: "Gekauft am:",
    validUntil: "Gültig bis:",
    emailNotification: "E-Mail-Benachrichtigung",
    recipientInfoPass: "Der Empfänger erhält eine E-Mail mit den Gutscheindetails und Hinweisen zur Einlösung.",
    recipientInfoValue: "Der Empfänger erhält eine E-Mail mit den Gutscheindetails und Hinweisen zur Einlösung.",
    generatingPdf: "PDF wird erstellt …",
    downloadPass: "Behandlungsgutschein als PDF herunterladen",
    downloadValue: "Gutschein als PDF herunterladen",
    pdfHint: "Druckbare PDF-Version des Gutscheins herunterladen",
    needHelp: "Hilfe benötigt?",
    contactUs: "Kontakt aufnehmen",
  },
};

export default function GiftCardSuccess() {
  const { t, locale } = useBookingText(TEXT);
  const [loading, setLoading] = useState(true);
  const [giftCard, setGiftCard] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [giftCardSettings, setGiftCardSettings] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailedError, setDetailedError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    fetchGiftCardDetails();
  }, []);

  const fetchGiftCardDetails = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const currentSessionId = params.get('session_id');
      const giftCardId = params.get('gift_card_id');

      setSessionId(currentSessionId);

      let giftCardData = null;

      if (giftCardId) {
        // Legacy flow: fetch by gift card ID
        const { data, error } = await supabase
          .from('gift_cards')
          .select('*, service_durations(duration_minutes)')
          .eq('id', giftCardId)
          .maybeSingle();

        if (error || !data) {
          setError(t.errNotFound);
          setLoading(false);
          return;
        }
        giftCardData = data;
      } else if (currentSessionId) {
        // New flow: fetch by session ID
        console.log(`Attempting to fetch gift card for session: ${currentSessionId}`);

        // Wait a moment for webhook to process
        await new Promise(resolve => setTimeout(resolve, 3000));

        const { data, error } = await supabase
          .from('gift_cards')
          .select('*, service_durations(duration_minutes)')
          .eq('stripe_session_id', currentSessionId)
          .maybeSingle();

        if (error || !data) {
          console.log('First attempt failed, trying again after delay...');
          // Try one more time after a longer wait
          await new Promise(resolve => setTimeout(resolve, 4000));

          const { data: retryData, error: retryError } = await supabase
            .from('gift_cards')
            .select('*, service_durations(duration_minutes)')
            .eq('stripe_session_id', currentSessionId)
            .maybeSingle();

          if (retryError || !retryData) {
            // Webhook didn't process in time, try manual processing
            console.log('Webhook delayed, attempting manual gift card creation...');

            try {
              // Try to get business_id from URL params
              const businessIdParam = params.get('business_id');

              const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-gift-card-session${businessIdParam ? `?business_id=${businessIdParam}` : ''}`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ sessionId: currentSessionId }),
                }
              );

              if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = errorData.error || t.errProcessFallback;
                console.error('Manual processing failed:', errorMessage);

                // If it's a duplicate key error, the gift card exists - try to fetch it
                if (errorMessage.includes('duplicate key') || errorMessage.includes('23505')) {
                  console.log('Duplicate key error detected, gift card likely exists. Attempting final fetch...');

                  const { data: duplicateCheckData, error: duplicateCheckError } = await supabase
                    .from('gift_cards')
                    .select('*, service_durations(duration_minutes)')
                    .eq('stripe_session_id', currentSessionId)
                    .maybeSingle();

                  if (!duplicateCheckError && duplicateCheckData) {
                    console.log('Successfully found existing gift card after duplicate error');
                    giftCardData = duplicateCheckData;
                  } else {
                    throw new Error(errorMessage);
                  }
                } else {
                  throw new Error(errorMessage);
                }
              } else {
                const result = await response.json();
                console.log('Manual processing result:', result);

                // Try fetching the gift card one more time
                const { data: finalData, error: finalError } = await supabase
                  .from('gift_cards')
                  .select('*, service_durations(duration_minutes)')
                  .eq('stripe_session_id', currentSessionId)
                  .maybeSingle();

                if (finalError || !finalData) {
                  console.error('Failed to fetch gift card after manual creation');
                  throw new Error(t.errRetrieve);
                }

                giftCardData = finalData;
              }
            } catch (err: any) {
              console.error('Error processing gift card:', err);
              setError(t.errProcess);
              setDetailedError(err.message || t.errUnexpected);
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
        setError(t.errMissing);
        setDetailedError(t.errMissingDetail);
        setLoading(false);
        return;
      }

      setGiftCard(giftCardData);

      // Fetch business details for PDF generation
      console.log('Fetching business details for business_id:', giftCardData.business_id);
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('name')
        .eq('id', giftCardData.business_id)
        .maybeSingle();

      if (businessError) {
        console.error('Error fetching business data:', businessError);
      }

      if (!businessData) {
        console.warn('No business data returned');
      }

      // Fetch currency settings
      const { data: currencySettings } = await supabase
        .from('site_settings')
        .select('value')
        .eq('business_id', giftCardData.business_id)
        .eq('key', 'currency')
        .maybeSingle();

      let currencyCode = 'USD';

      if (currencySettings?.value) {
        let configuredCurrency = currencySettings.value;
        try {
          const parsed = JSON.parse(configuredCurrency);
          if (typeof parsed === 'string') configuredCurrency = parsed;
        } catch {
          // Stored as a plain ISO currency code.
        }
        currencyCode = configuredCurrency.toUpperCase();
      } else {
        const { data: legacyCurrency } = await supabase
          .from('site_settings')
          .select('currency')
          .eq('business_id', giftCardData.business_id)
          .not('currency', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (legacyCurrency?.currency) currencyCode = legacyCurrency.currency.toUpperCase();
      }

      const currencySymbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;

      // Combine business data with currency
      const fullBusinessData = {
        name: businessData?.name || t.businessFallback,
        currency_code: currencyCode,
        currency_symbol: currencySymbol,
      };

      console.log('Business data loaded successfully:', fullBusinessData);
      setBusiness(fullBusinessData);

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
      setError(t.errLoad);
      setLoading(false);
    }
  };

  const formatPrice = (cents: number) => {
    return formatCurrency(cents, business?.currency_code || 'USD');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleRetry = async () => {
    setRetrying(true);
    setError(null);
    setDetailedError(null);
    setLoading(true);
    await fetchGiftCardDetails();
    setRetrying(false);
  };

  const handleDownloadPDF = async () => {
    if (!giftCard) {
      alert(t.alertNoCard);
      return;
    }

    if (!business) {
      alert(t.alertNoBusiness);
      return;
    }

    try {
      setDownloadingPdf(true);
      console.log('Starting PDF download...');

      await downloadGiftCardPDF({
        code: giftCard.code,
        amount: giftCard.original_value_cents / 100,
        cardType: giftCard.card_type || 'value',
        servicePassName: giftCard.service_pass_name,
        visits: giftCard.original_visits,
        durationMinutes: giftCard.service_durations?.duration_minutes,
        designUrl: giftCardSettings?.design_url || null,
        termsAndConditions: giftCardSettings?.terms_and_conditions || null,
        businessName: business.name,
        expiresAt: giftCard.expires_at,
        currencySymbol: business.currency_symbol || CURRENCY_SYMBOLS[business.currency_code] || business.currency_code || CURRENCY_SYMBOLS.USD,
      });

      console.log('PDF download initiated successfully');
    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert(t.alertPdfFailed);
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
        <div className="max-w-lg w-full bg-white p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-2xl">❌</span>
            </div>
            <h1 className="text-2xl font-light text-stone-800 mb-2">
              {t.unableTitle}
            </h1>
            <p className="text-stone-600 mb-4">{error || t.somethingWrong}</p>

            {detailedError && (
              <div className="bg-stone-50 border border-stone-200 p-4 rounded mb-4 text-left">
                <p className="text-sm text-stone-700 mb-2 font-medium">{t.errorDetails}</p>
                <p className="text-sm text-stone-600 break-words">{detailedError}</p>
              </div>
            )}

            {sessionId && (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded mb-4 text-left">
                <p className="text-sm text-blue-900 mb-2 font-medium">{t.sessionIdLabel}</p>
                <p className="text-xs text-blue-800 font-mono break-all">{sessionId}</p>
                <p className="text-xs text-blue-700 mt-2">
                  {t.saveSessionId}
                </p>
              </div>
            )}

            <div className="space-y-3">
              {sessionId && (
                <button
                  onClick={handleRetry}
                  disabled={retrying}
                  className="w-full px-6 py-3 bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {retrying ? t.retrying : t.tryAgain}
                </button>
              )}

              <div className="pt-4 border-t border-stone-200">
                <p className="text-sm text-stone-600 mb-2">
                  {t.paymentOkHint}
                </p>
                <a
                  href={BRAND_SUPPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-stone-700 hover:underline inline-flex items-center gap-1"
                >
                  {t.contactSupport}
                </a>
              </div>
            </div>
          </div>
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
            {giftCard.card_type === 'service_pass' ? t.titlePass : t.titleValue}
          </h1>
          <p className="text-stone-600 leading-relaxed">
            {t.paymentProcessed}
            {giftCard.purchased_for_email && (
              <>
                {' '}{giftCard.card_type === 'service_pass' ? t.sentToPass : t.sentToValue}{' '}
                <span className="font-medium">{giftCard.purchased_for_email}</span>
                {t.sentToSuffix}
              </>
            )}
          </p>
        </div>

        <div className="border border-stone-200 p-6 md:p-8 mb-8 bg-gradient-to-br from-stone-50 to-stone-100">
          <div className="flex items-center justify-center mb-6">
            <Gift className="w-16 h-16 text-stone-700" />
          </div>

          <h2 className="text-center text-2xl font-light text-stone-800 mb-2">
            {giftCard.card_type === 'service_pass' ? t.cardLabelPass : t.cardLabelValue}
          </h2>
          <p className="text-center text-3xl font-medium text-stone-900 mb-6">
            {giftCard.card_type === 'service_pass'
              ? giftCard.service_pass_name || t.passNameFallback
              : formatPrice(giftCard.original_value_cents)}
          </p>

          {giftCard.card_type === 'service_pass' && (
            <p className="-mt-3 mb-6 text-center text-sm text-stone-500">
              {fillText(giftCard.original_visits === 1 ? t.visitOne : t.visitMany, { count: giftCard.original_visits })}
              {giftCard.service_durations?.duration_minutes ? fillText(t.minutesEach, { minutes: giftCard.service_durations.duration_minutes }) : ''}
            </p>
          )}

          <div className="space-y-4 bg-white p-6 rounded-lg border border-stone-200">
            <div className="flex justify-between items-center pb-3 border-b border-stone-200">
              <span className="text-sm text-stone-600">{giftCard.card_type === 'service_pass' ? t.codeLabelPass : t.codeLabelValue}</span>
              <span className="text-lg font-mono font-medium text-stone-900">
                {giftCard.code}
              </span>
            </div>

            <div className="flex justify-between items-center pb-3 border-b border-stone-200">
              <span className="text-sm text-stone-600">{giftCard.card_type === 'service_pass' ? t.visitsRemaining : t.balance}</span>
              <span className="text-stone-900 font-medium">
                {giftCard.card_type === 'service_pass'
                  ? fillText(t.remainingOf, { remaining: giftCard.remaining_visits, total: giftCard.original_visits })
                  : formatPrice(giftCard.current_balance_cents)}
              </span>
            </div>

            {giftCard.card_type === 'service_pass' && (
              <div className="flex justify-between items-center pb-3 border-b border-stone-200">
                <span className="text-sm text-stone-600">{t.purchasedFor}</span>
                <span className="text-stone-900 font-medium">{formatPrice(giftCard.purchase_price_cents)}</span>
              </div>
            )}

            {giftCard.purchased_for_email && (
              <div className="flex justify-between items-center pb-3 border-b border-stone-200">
                <span className="text-sm text-stone-600">{t.recipientEmail}</span>
                <span className="text-stone-900 font-medium">
                  {giftCard.purchased_for_email}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center pb-3 border-b border-stone-200">
              <span className="text-sm text-stone-600">{t.purchasedOn}</span>
              <span className="text-stone-900 font-medium">
                {formatDate(giftCard.purchased_at)}
              </span>
            </div>

            {giftCard.expires_at && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-stone-600">{t.validUntil}</span>
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
                <h3 className="font-medium text-stone-800 mb-1">{t.emailNotification}</h3>
                <p className="text-sm text-stone-600 leading-relaxed">
                  {giftCard.card_type === 'service_pass' ? t.recipientInfoPass : t.recipientInfoValue}
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
            {downloadingPdf ? t.generatingPdf : giftCard.card_type === 'service_pass' ? t.downloadPass : t.downloadValue}
          </button>
          <p className="text-xs text-stone-500 text-center mt-2">
            {t.pdfHint}
          </p>
        </div>

        <div className="text-center">
          <p className="text-sm text-stone-500">
            {t.needHelp}{' '}
            <a
              href={BRAND_SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-700 hover:underline"
            >
              {t.contactUs}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
