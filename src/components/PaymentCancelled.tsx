import { useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useBookingText, type Translations } from '../lib/bookingLanguage';

const TEXT: Translations<{
  title: string;
  body: string;
  whatHappened: string;
  whatHappenedBody: string;
  exit: string;
  needHelp: string;
}> = {
  en: {
    title: 'Payment Cancelled',
    body: "Your payment was cancelled and no charges were made to your account. You can try booking again whenever you're ready.",
    whatHappened: 'What happened?',
    whatHappenedBody: 'You chose to cancel the payment process. Your booking was not completed, and you can start a new booking at any time.',
    exit: 'Exit',
    needHelp: "Need help? Contact our support team and we'll be happy to assist you with your booking.",
  },
  de: {
    title: 'Zahlung abgebrochen',
    body: 'Die Zahlung wurde abgebrochen, es wurde nichts abgebucht. Eine neue Buchung ist jederzeit möglich.',
    whatHappened: 'Was ist passiert?',
    whatHappenedBody: 'Der Bezahlvorgang wurde abgebrochen. Die Buchung wurde daher nicht abgeschlossen – eine neue Buchung ist jederzeit möglich.',
    exit: 'Schließen',
    needHelp: 'Fragen? Wir helfen Ihnen gerne bei Ihrer Buchung weiter.',
  },
};

export default function PaymentCancelled() {
  const { t } = useBookingText(TEXT);
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionIdParam = urlParams.get('session_id');

    if (sessionIdParam) {
      sessionStorage.removeItem(`booking_session_${sessionIdParam}`);
    }
  }, []);

  const handleExit = () => {
    window.close();
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 md:p-12 shadow-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-amber-600" />
          </div>
          <h1 className="text-3xl font-light text-stone-800 mb-3">
            {t.title}
          </h1>
          <p className="text-stone-600 leading-relaxed">
            {t.body}
          </p>
        </div>

        <div className="border-t border-stone-200 pt-8 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-stone-800 mb-2 text-sm">{t.whatHappened}</h3>
            <p className="text-sm text-stone-600 leading-relaxed">
              {t.whatHappenedBody}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleExit}
              className="w-full px-6 py-3 bg-stone-800 text-white hover:bg-stone-700 transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-5 h-5" />
              {t.exit}
            </button>
          </div>

          <div className="text-center pt-4">
            <p className="text-xs text-stone-500 leading-relaxed">
              {t.needHelp}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
