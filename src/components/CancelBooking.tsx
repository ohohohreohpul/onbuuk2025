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
  cancelledEmail: string;
  warningEmail: string;
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
    cancelledBody: 'Your booking has been cancelled.',
    cancelledEmail: 'A confirmation goes to {email}.',
    warningEmail: 'You will get a confirmation email.',
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
    warning: 'This action cannot be undone.',
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
    cancelledBody: 'Die Buchung wurde storniert.',
    cancelledEmail: 'Eine Bestätigung geht an {email}.',
    warningEmail: 'Sie erhalten eine Bestätigung per E-Mail.',
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
    warning: 'Die Stornierung kann nicht rückgängig gemacht werden.',
    keepBooking: 'Buchung behalten',
    cancelling: 'Wird storniert …',
  },
  th: {
    errorInvalidLink: 'ลิงก์ยกเลิกไม่ถูกต้อง',
    errorAlreadyCancelled: 'การจองนี้ถูกยกเลิกแล้ว',
    errorNotFound: 'ไม่พบการจอง',
    errorCancelFailed: 'ไม่สามารถยกเลิกการจองได้ กรุณาติดต่อร้านโดยตรง',
    loading: 'กำลังโหลดรายละเอียดการจอง...',
    cancelledTitle: 'ยกเลิกการจองแล้ว',
    cancelledBody: 'ยกเลิกการจองเรียบร้อยแล้ว',
    cancelledEmail: 'อีเมลยืนยันจะส่งไปที่ {email}',
    warningEmail: 'คุณจะได้รับอีเมลยืนยัน',
    unableToCancel: 'ไม่สามารถยกเลิกได้',
    cancelBooking: 'ยกเลิกการจอง',
    bookingDetails: 'รายละเอียดการจอง',
    customer: 'ชื่อลูกค้า:',
    service: 'บริการ:',
    date: 'วันที่:',
    time: 'เวลา:',
    duration: 'ระยะเวลา:',
    minutes: '{count} นาที',
    important: 'สำคัญ:',
    warning: 'การยกเลิกนี้ไม่สามารถย้อนกลับได้',
    keepBooking: 'เก็บการจองไว้',
    cancelling: 'กำลังยกเลิก...',
  },
};

type CancelErrorKey = 'errorInvalidLink' | 'errorAlreadyCancelled' | 'errorNotFound' | 'errorCancelFailed';

// Dates in the cancellation email variables stay in the format the server has always received.

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
  const [sendsEmails, setSendsEmails] = useState(false);
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
      // Guests can't read bookings directly; the id in the link is the key.
      const { data, error } = await supabase.rpc('get_booking_by_link', { p_booking_id: bookingId });

      if (error) throw error;
      if (!data) throw new Error('Booking not found');

      if (data.status === 'cancelled') {
        setError('errorAlreadyCancelled');
      } else {
        setBooking(data as any);
        const { data: sends, error: senderError } = await supabase.rpc('shop_sends_booking_emails', { p_business_id: data.business_id });
        if (senderError) console.error('Could not check the shop email sender:', senderError);
        setSendsEmails(sends === true);
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
      const { data: result, error } = await supabase.rpc('cancel_booking_by_link', { p_booking_id: booking.id });

      if (error) throw error;
      if (result === 'already_cancelled') {
        setError('errorAlreadyCancelled');
        return;
      }
      if (result !== 'cancelled') throw new Error(`Cancellation refused: ${result}`);

      // The cancellation emails (customer + shop) are queued by the database.
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
            {t.cancelledBody}
            {sendsEmails && booking?.customer_email && <> {fillText(t.cancelledEmail, { email: booking.customer_email })}</>}
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
              <span className="font-medium">{booking?.start_time?.slice(0, 5)}</span>
            </p>
            <p>
              <span className="text-stone-600">{t.duration}</span>{' '}
              <span className="font-medium">{fillText(t.minutes, { count: booking?.duration.duration_minutes ?? '' })}</span>
            </p>
          </div>
        </div>

        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded">
          <p className="text-sm text-amber-800">
            <strong>{t.important}</strong> {t.warning}{sendsEmails && <> {t.warningEmail}</>}
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
