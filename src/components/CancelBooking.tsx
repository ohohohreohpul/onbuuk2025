import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import { useBookingText, fillText, type Translations } from '../lib/bookingLanguage';

const TEXT: Translations<{
  errorInvalidLink: string;
  errorAlreadyCancelled: string;
  errorNotFound: string;
  errorCancelFailed: string;
  loading: string;
  cancelledTitle: string;
  cancelledBody: string;
  unableToCancel: string;
  cancelBooking: string;
  bookingDetails: string;
  customer: string;
  service: string;
  date: string;
  time: string;
  duration: string;
  minutes: string;
  important: string;
  warning: string;
  keepBooking: string;
  cancelling: string;
}> = {
  en: {
    errorInvalidLink: 'Invalid cancellation link',
    errorAlreadyCancelled: 'This booking has already been cancelled',
    errorNotFound: 'Booking not found',
    errorCancelFailed: 'Failed to cancel booking. Please contact support.',
    loading: 'Loading booking details...',
    cancelledTitle: 'Booking Cancelled',
    cancelledBody: 'Your booking has been successfully cancelled. A confirmation email has been sent to',
    unableToCancel: 'Unable to Cancel',
    cancelBooking: 'Cancel Booking',
    bookingDetails: 'Booking Details',
    customer: 'Customer:',
    service: 'Service:',
    date: 'Date:',
    time: 'Time:',
    duration: 'Duration:',
    minutes: '{count} minutes',
    important: 'Important:',
    warning: 'This action cannot be undone. You will receive a confirmation email once the cancellation is complete.',
    keepBooking: 'Keep Booking',
    cancelling: 'Cancelling...',
  },
  de: {
    errorInvalidLink: 'Ungültiger Stornierungslink',
    errorAlreadyCancelled: 'Diese Buchung wurde bereits storniert',
    errorNotFound: 'Buchung nicht gefunden',
    errorCancelFailed: 'Die Buchung konnte nicht storniert werden. Bitte kontaktieren Sie uns direkt.',
    loading: 'Buchungsdetails werden geladen …',
    cancelledTitle: 'Buchung storniert',
    cancelledBody: 'Die Buchung wurde erfolgreich storniert. Eine Bestätigung wurde per E-Mail gesendet an',
    unableToCancel: 'Stornierung nicht möglich',
    cancelBooking: 'Buchung stornieren',
    bookingDetails: 'Buchungsdetails',
    customer: 'Name:',
    service: 'Behandlung:',
    date: 'Datum:',
    time: 'Uhrzeit:',
    duration: 'Dauer:',
    minutes: '{count} Minuten',
    important: 'Wichtig:',
    warning: 'Die Stornierung kann nicht rückgängig gemacht werden. Nach Abschluss erhalten Sie eine Bestätigung per E-Mail.',
    keepBooking: 'Buchung behalten',
    cancelling: 'Wird storniert …',
  },
};

type CancelErrorKey = 'errorInvalidLink' | 'errorAlreadyCancelled' | 'errorNotFound' | 'errorCancelFailed';

// Dates in the cancellation email variables stay in the format the server has always received.
const EMAIL_DATE_LOCALE = 'en-US';

interface Booking {
  id: string;
  business_id: string;
  customer_name: string;
  customer_email: string;
  booking_date: string;
  start_time: string;
  status: string;
  service: { name: string };
  duration: { duration_minutes: number };
}

export default function CancelBooking() {
  const { t, locale } = useBookingText(TEXT);
  const urlParams = new URLSearchParams(window.location.search);
  const bookingId = urlParams.get('id');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState<CancelErrorKey | ''>('');

  useEffect(() => {
    if (bookingId) {
      fetchBooking();
    } else {
      setError('errorInvalidLink');
      setLoading(false);
    }
  }, [bookingId]);

  const fetchBooking = async () => {
    if (!bookingId) return;

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          service:services(name),
          duration:service_durations(duration_minutes)
        `)
        .eq('id', bookingId)
        .single();

      if (error) throw error;

      if (data.status === 'cancelled') {
        setError('errorAlreadyCancelled');
      } else {
        setBooking(data as any);
      }
    } catch (err) {
      setError('errorNotFound');
    } finally {
      setLoading(false);
    }
  };

  const handleCancellation = async () => {
    if (!booking) return;

    setCancelling(true);

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', booking.id);

      if (error) throw error;

      const { data: business } = await supabase
        .from('businesses')
        .select('name, phone')
        .eq('id', booking.business_id)
        .maybeSingle();

      const rebookLink = `${window.location.origin}`;

      await supabase.functions.invoke('send-business-email', {
        body: {
          business_id: booking.business_id,
          event_key: 'booking_cancelled',
          recipient_email: booking.customer_email,
          recipient_name: booking.customer_name,
          variables: {
            customer_name: booking.customer_name,
            service_name: booking.service.name,
            booking_date: formatDate(booking.booking_date, EMAIL_DATE_LOCALE),
            booking_time: booking.start_time,
            cancellation_reason: '',
            cancelled_by: 'customer',
            business_name: business?.name || 'Our Business',
            business_phone: business?.phone || '',
            rebook_link: rebookLink,
          },
        },
      });

      setCancelled(true);
    } catch (err) {
      setError('errorCancelFailed');
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (dateString: string, dateLocale: string = locale) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(dateLocale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-stone-600">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (cancelled) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white border border-stone-200 max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-light text-stone-800 mb-2">{t.cancelledTitle}</h1>
          <p className="text-stone-600">
            {t.cancelledBody}{' '}
            <strong>{booking?.customer_email}</strong>.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white border border-red-200 max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-light text-stone-800 mb-2">{t.unableToCancel}</h1>
          <p className="text-stone-600">{t[error]}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="bg-white border border-stone-200 max-w-md w-full p-8">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <X className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-light text-stone-800">{t.cancelBooking}</h1>
          </div>
        </div>

        <div className="mb-6 p-4 bg-stone-50 border border-stone-200 rounded space-y-2">
          <h2 className="font-medium text-stone-800 mb-3">{t.bookingDetails}</h2>
          <div className="text-sm space-y-1">
            <p>
              <span className="text-stone-600">{t.customer}</span>{' '}
              <span className="font-medium">{booking?.customer_name}</span>
            </p>
            <p>
              <span className="text-stone-600">{t.service}</span>{' '}
              <span className="font-medium">{booking?.service.name}</span>
            </p>
            <p>
              <span className="text-stone-600">{t.date}</span>{' '}
              <span className="font-medium">{booking && formatDate(booking.booking_date)}</span>
            </p>
            <p>
              <span className="text-stone-600">{t.time}</span>{' '}
              <span className="font-medium">{booking?.start_time}</span>
            </p>
            <p>
              <span className="text-stone-600">{t.duration}</span>{' '}
              <span className="font-medium">{fillText(t.minutes, { count: booking?.duration.duration_minutes ?? '' })}</span>
            </p>
          </div>
        </div>

        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded">
          <p className="text-sm text-amber-800">
            <strong>{t.important}</strong> {t.warning}
          </p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={() => window.close()}
            className="flex-1 px-6 py-3 border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
          >
            {t.keepBooking}
          </button>
          <button
            onClick={handleCancellation}
            disabled={cancelling}
            className="flex-1 px-6 py-3 bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {cancelling ? t.cancelling : t.cancelBooking}
          </button>
        </div>
      </div>
    </div>
  );
}
