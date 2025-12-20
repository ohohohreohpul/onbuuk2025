import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

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
  const urlParams = new URLSearchParams(window.location.search);
  const bookingId = urlParams.get('id');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (bookingId) {
      fetchBooking();
    } else {
      setError('Invalid cancellation link');
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
        setError('This booking has already been cancelled');
      } else {
        setBooking(data as any);
      }
    } catch (err) {
      setError('Booking not found');
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
            booking_date: formatDate(booking.booking_date),
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
      setError('Failed to cancel booking. Please contact support.');
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
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
          <p className="text-stone-600">Loading booking details...</p>
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
          <h1 className="text-2xl font-light text-stone-800 mb-2">Booking Cancelled</h1>
          <p className="text-stone-600">
            Your booking has been successfully cancelled. A confirmation email has been sent to{' '}
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
          <h1 className="text-2xl font-light text-stone-800 mb-2">Unable to Cancel</h1>
          <p className="text-stone-600">{error}</p>
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
            <h1 className="text-2xl font-light text-stone-800">Cancel Booking</h1>
          </div>
        </div>

        <div className="mb-6 p-4 bg-stone-50 border border-stone-200 rounded space-y-2">
          <h2 className="font-medium text-stone-800 mb-3">Booking Details</h2>
          <div className="text-sm space-y-1">
            <p>
              <span className="text-stone-600">Customer:</span>{' '}
              <span className="font-medium">{booking?.customer_name}</span>
            </p>
            <p>
              <span className="text-stone-600">Service:</span>{' '}
              <span className="font-medium">{booking?.service.name}</span>
            </p>
            <p>
              <span className="text-stone-600">Date:</span>{' '}
              <span className="font-medium">{booking && formatDate(booking.booking_date)}</span>
            </p>
            <p>
              <span className="text-stone-600">Time:</span>{' '}
              <span className="font-medium">{booking?.start_time}</span>
            </p>
            <p>
              <span className="text-stone-600">Duration:</span>{' '}
              <span className="font-medium">{booking?.duration.duration_minutes} minutes</span>
            </p>
          </div>
        </div>

        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded">
          <p className="text-sm text-amber-800">
            <strong>Important:</strong> This action cannot be undone. You will receive a confirmation
            email once the cancellation is complete.
          </p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={() => window.close()}
            className="flex-1 px-6 py-3 border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
          >
            Keep Booking
          </button>
          <button
            onClick={handleCancellation}
            disabled={cancelling}
            className="flex-1 px-6 py-3 bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {cancelling ? 'Cancelling...' : 'Cancel Booking'}
          </button>
        </div>
      </div>
    </div>
  );
}
