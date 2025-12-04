import { useState, useEffect } from 'react';
import { Check, Calendar, Clock, Mail, Phone, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../lib/tenantContext';
import AccountCreationPrompt from './AccountCreationPrompt';

export default function BookingSuccess() {
  const tenant = useTenant();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<any>(null);
  const [service, setService] = useState<any>(null);
  const [specialist, setSpecialist] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBookingDetails();
  }, []);

  const fetchBookingDetails = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session_id');
      const bookingId = params.get('booking_id');

      if (!bookingId) {
        setError('Booking ID not found');
        setLoading(false);
        return;
      }

      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .maybeSingle();

      if (bookingError || !bookingData) {
        setError('Booking not found');
        setLoading(false);
        return;
      }

      setBooking(bookingData);

      const { data: serviceData } = await supabase
        .from('services')
        .select('*')
        .eq('id', bookingData.service_id)
        .maybeSingle();

      if (serviceData) {
        setService(serviceData);
      }

      if (bookingData.specialist_id) {
        const { data: specialistData } = await supabase
          .from('specialists')
          .select('*')
          .eq('id', bookingData.specialist_id)
          .maybeSingle();

        if (specialistData) {
          setSpecialist(specialistData);
        }
      }

      if (sessionId) {
        await supabase
          .from('bookings')
          .update({ stripe_session_id: sessionId })
          .eq('id', bookingId);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching booking details:', err);
      setError('Failed to load booking details');
      setLoading(false);
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

  const formatPrice = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <span className="text-2xl">❌</span>
          </div>
          <h1 className="text-2xl font-light text-stone-800 mb-2">
            Unable to Load Booking
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
            Booking Confirmed!
          </h1>
          <p className="text-stone-600 leading-relaxed">
            Your payment has been processed successfully. We've sent a confirmation email to{' '}
            <span className="font-medium">{booking.customer_email}</span>
          </p>
        </div>

        <div className="border border-stone-200 p-6 md:p-8 mb-8 bg-stone-50">
          <h2 className="text-sm font-medium text-stone-700 uppercase tracking-wider mb-6">
            Booking Details
          </h2>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center flex-shrink-0">
                <span className="text-lg">🎯</span>
              </div>
              <div className="flex-1">
                <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">
                  Booking ID
                </p>
                <p className="text-stone-800 font-medium">
                  {booking.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
            </div>

            {service && (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">✨</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">
                    Service
                  </p>
                  <p className="text-stone-800 font-medium">{service.name}</p>
                </div>
              </div>
            )}

            {specialist && (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-stone-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">
                    Specialist
                  </p>
                  <p className="text-stone-800 font-medium">{specialist.name}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-stone-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">
                  Date
                </p>
                <p className="text-stone-800 font-medium">
                  {formatDate(booking.booking_date)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-stone-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">
                  Time
                </p>
                <p className="text-stone-800 font-medium">{booking.start_time}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-stone-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">
                  Customer Name
                </p>
                <p className="text-stone-800 font-medium">{booking.customer_name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-stone-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">
                  Email
                </p>
                <p className="text-stone-800 font-medium">{booking.customer_email}</p>
              </div>
            </div>

            {booking.customer_phone && (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-stone-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">
                    Phone
                  </p>
                  <p className="text-stone-800 font-medium">{booking.customer_phone}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <AccountCreationPrompt
          customerEmail={booking.customer_email}
          customerName={booking.customer_name}
          businessId={tenant.businessId!}
        />

        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-stone-800 mb-2">What's Next?</h3>
          <ul className="text-sm text-stone-600 space-y-2 leading-relaxed">
            <li>• Please arrive 10 minutes before your appointment</li>
            <li>• You'll receive a reminder email 24 hours before your booking</li>
            <li>• To reschedule or cancel, please contact us at least 24 hours in advance</li>
          </ul>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => (window.location.href = '/')}
            className="px-8 py-3 bg-stone-800 text-white hover:bg-stone-700 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    </div>
  );
}
