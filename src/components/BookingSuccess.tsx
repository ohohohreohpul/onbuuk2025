import { useState, useEffect } from 'react';
import { Check, Calendar, Clock, Mail, Phone, User, CheckCircle, ArrowRight, Sparkles, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../lib/tenantContext';
import AccountCreationPrompt from './AccountCreationPrompt';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function BookingSuccess() {
  const tenant = useTenant();
  const [loading, setLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [booking, setBooking] = useState<any>(null);
  const [service, setService] = useState<any>(null);
  const [specialist, setSpecialist] = useState<any>(null);
  const [bookingProducts, setBookingProducts] = useState<any[]>([]);
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

      // Fetch booking products (add-ons)
      const { data: productsData } = await supabase
        .from('booking_products')
        .select(`
          id,
          quantity,
          price_cents,
          product_id,
          products (
            id,
            name
          )
        `)
        .eq('booking_id', bookingId);

      if (productsData && productsData.length > 0) {
        setBookingProducts(productsData);
      }

      if (sessionId) {
        await supabase
          .from('bookings')
          .update({ stripe_session_id: sessionId })
          .eq('id', bookingId);
      }

      setLoading(false);
      setTimeout(() => setIsLoaded(true), 100);
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center relative">
        <div className="absolute inset-0 gradient-mesh opacity-30 pointer-events-none" />
        <div className="text-center relative z-10">
          <div className="w-10 h-10 border-3 border-[#008374]/20 border-t-[#008374] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4 relative">
        <div className="absolute inset-0 gradient-mesh opacity-30 pointer-events-none" />
        <Card glass className="max-w-md w-full relative z-10">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-100 flex items-center justify-center">
              <span className="text-2xl">❌</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2 tracking-tight">
              Unable to Load Booking
            </h1>
            <p className="text-muted-foreground mb-6">{error || 'Something went wrong'}</p>
            <Button
              onClick={() => (window.location.href = '/')}
              className="bg-gradient-to-r from-[#008374] to-[#00a894] hover:shadow-lg hover:shadow-[#008374]/25"
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4 relative">
      {/* Background decorations */}
      <div className="absolute inset-0 gradient-mesh opacity-30 pointer-events-none" />
      <div className="absolute top-20 right-20 w-72 h-72 bg-green-500/10 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-[#008374]/10 rounded-full blur-3xl animate-pulse-slow animation-delay-300" />

      <Card glass className={`max-w-2xl w-full relative z-10 shadow-2xl shadow-black/5 transform transition-all duration-700 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
        <CardContent className="p-8 md:p-12">
          {/* Success Header */}
          <div className="text-center mb-10">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-green-500/30 rounded-full blur-xl scale-150 animate-pulse-slow" />
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center relative shadow-lg shadow-green-500/30">
                <Check className="w-10 h-10 text-white" />
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3 tracking-tight">
              Booking Confirmed!
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              Your payment has been processed successfully. We've sent a confirmation email to{' '}
              <span className="font-semibold text-foreground">{booking.customer_email}</span>
            </p>
          </div>

          {/* Booking Details Card */}
          <div className="bg-white/50 backdrop-blur-sm rounded-2xl border border-gray-100 p-6 md:p-8 mb-8">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#008374]" />
              Booking Details
            </h2>

            <div className="space-y-4">
              <DetailRow
                icon={<span className="text-lg">🎯</span>}
                label="Booking ID"
                value={booking.id.slice(0, 8).toUpperCase()}
              />

              {service && (
                <DetailRow
                  icon={<span className="text-lg">✨</span>}
                  label="Service"
                  value={service.name}
                />
              )}

              {specialist && (
                <DetailRow
                  icon={<User className="w-5 h-5 text-[#008374]" />}
                  label="Specialist"
                  value={specialist.name}
                />
              )}

              <DetailRow
                icon={<Calendar className="w-5 h-5 text-[#008374]" />}
                label="Date"
                value={formatDate(booking.booking_date)}
              />

              <DetailRow
                icon={<Clock className="w-5 h-5 text-[#008374]" />}
                label="Time"
                value={booking.start_time}
              />

              <DetailRow
                icon={<User className="w-5 h-5 text-[#008374]" />}
                label="Customer Name"
                value={booking.customer_name}
              />

              <DetailRow
                icon={<Mail className="w-5 h-5 text-[#008374]" />}
                label="Email"
                value={booking.customer_email}
              />

              {booking.customer_phone && (
                <DetailRow
                  icon={<Phone className="w-5 h-5 text-[#008374]" />}
                  label="Phone"
                  value={booking.customer_phone}
                />
              )}

              {/* Add-Ons Section */}
              {bookingProducts.length > 0 && (
                <div className="pt-4 mt-4 border-t border-gray-100">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/80 backdrop-blur-sm border border-gray-100 flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5 text-[#008374]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                        Add-Ons
                      </p>
                      <div className="space-y-1">
                        {bookingProducts.map((item: any) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-foreground">
                              {(item.products as any)?.name || 'Product'} {item.quantity > 1 && `×${item.quantity}`}
                            </span>
                            <span className="text-foreground font-medium">
                              {formatPrice(item.price_cents * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
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

          {/* What's Next Card */}
          <div className="mt-8 p-6 bg-[#008374]/5 backdrop-blur-sm border border-[#008374]/20 rounded-2xl">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#008374]" />
              What's Next?
            </h3>
            <ul className="text-sm text-muted-foreground space-y-2 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-[#008374]">•</span>
                Please arrive 10 minutes before your appointment
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#008374]">•</span>
                You'll receive a reminder email 24 hours before your booking
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#008374]">•</span>
                To reschedule or cancel, please contact us at least 24 hours in advance
              </li>
            </ul>
          </div>

          {/* Return Button */}
          <div className="mt-8 text-center">
            <Button
              onClick={() => (window.location.href = '/')}
              className="h-12 px-8 bg-gradient-to-r from-[#008374] to-[#00a894] hover:shadow-lg hover:shadow-[#008374]/25 transition-all duration-300 group"
              size="lg"
            >
              Return to Home
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-white/80 backdrop-blur-sm border border-gray-100 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
          {label}
        </p>
        <p className="text-foreground font-medium">{value}</p>
      </div>
    </div>
  );
}
