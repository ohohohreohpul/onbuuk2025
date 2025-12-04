import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { processSendBusinessEmail } from "../_shared/business-email-service.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface BookingWithDetails {
  id: string;
  business_id: string;
  booking_date: string;
  start_time: string;
  customer_name: string;
  customer_email: string;
  service_name: string;
  specialist_name: string | null;
  business_name: string;
  business_address: string | null;
  business_phone: string | null;
  reminder_sent: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('🔔 Starting booking reminder job...');

    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrow = in24Hours.toISOString().split('T')[0];

    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        business_id,
        booking_date,
        start_time,
        customer_name,
        customer_email,
        businesses!inner(name, address, phone),
        services!inner(name),
        specialists(name)
      `)
      .eq('booking_date', tomorrow)
      .eq('status', 'confirmed')
      .is('reminder_sent', false);

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
      throw bookingsError;
    }

    console.log(`Found ${bookings?.length || 0} bookings needing reminders`);

    if (!bookings || bookings.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No reminders to send',
          sent: 0,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    let successCount = 0;
    let failureCount = 0;

    for (const booking of bookings) {
      try {
        const { data: settings } = await supabase
          .from('business_email_settings')
          .select('send_booking_reminders, emails_enabled')
          .eq('business_id', booking.business_id)
          .maybeSingle();

        if (!settings || !settings.emails_enabled || !settings.send_booking_reminders) {
          console.log(`Skipping booking ${booking.id} - reminders disabled`);
          continue;
        }

        const formatDate = (dateStr: string) => {
          const date = new Date(dateStr);
          return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        };

        const result = await processSendBusinessEmail({
          business_id: booking.business_id,
          event_key: 'booking_reminder',
          recipient_email: booking.customer_email,
          recipient_name: booking.customer_name,
          variables: {
            customer_name: booking.customer_name,
            service_name: booking.services?.name || 'Service',
            booking_date: formatDate(booking.booking_date),
            booking_time: booking.start_time,
            specialist_name: booking.specialists?.name || 'Your Specialist',
            business_name: booking.businesses?.name || 'Our Business',
            business_address: booking.businesses?.address || '',
            business_phone: booking.businesses?.phone || '',
            hours_until_appointment: '24',
          },
          booking_id: booking.id,
        });

        if (result.success) {
          await supabase
            .from('bookings')
            .update({ reminder_sent: true })
            .eq('id', booking.id);

          successCount++;
          console.log(`✅ Reminder sent for booking ${booking.id}`);
        } else {
          failureCount++;
          console.error(`❌ Failed to send reminder for booking ${booking.id}: ${result.message}`);
        }
      } catch (error) {
        failureCount++;
        console.error(`Error processing booking ${booking.id}:`, error);
      }
    }

    console.log(`🎉 Reminder job complete: ${successCount} sent, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Reminder job completed',
        sent: successCount,
        failed: failureCount,
        total: bookings.length,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Reminder job error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
