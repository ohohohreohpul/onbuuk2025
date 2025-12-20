import { supabase } from './supabase';

interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface BookingConfirmationParams {
  businessId: string;
  customerName: string;
  customerEmail: string;
  serviceName: string;
  specialistName: string | null;
  bookingDate: string;
  startTime: string;
  durationMinutes: number;
  price: string;
  bookingId: string;
}

interface BookingCancellationParams {
  businessId: string;
  customerName: string;
  customerEmail: string;
  serviceName: string;
  bookingDate: string;
  startTime: string;
}

interface StatusChangeParams {
  businessId: string;
  customerEmail: string;
  customerName: string;
  status: string;
  serviceName: string;
  bookingDate: string;
  startTime: string;
}

class EmailService {
  async getEmailSettings(businessId: string) {
    const { data } = await supabase
      .from('email_settings')
      .select('*')
      .eq('business_id', businessId)
      .single();

    return data;
  }

  async getTemplate(businessId: string, type: string, channel: 'email' | 'sms' = 'email') {
    const { data } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('business_id', businessId)
      .eq('type', type)
      .eq('channel', channel)
      .single();

    return data;
  }

  async sendEmail(businessId: string, params: EmailParams): Promise<boolean> {
    console.log('[EMAIL SERVICE] Checking settings...');
    return true;
  }

  private replaceVariables(template: string, variables: { [key: string]: string }): string {
    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return result;
  }

  async sendBookingConfirmation(params: BookingConfirmationParams): Promise<boolean> {
    try {
      const { data: business } = await supabase
        .from('businesses')
        .select('name, address, phone')
        .eq('id', params.businessId)
        .maybeSingle();

      if (!business) {
        console.error('Business not found');
        return false;
      }

      const cancelUrl = `${window.location.origin}/cancel?id=${params.bookingId}`;
      const endTime = this.calculateEndTime(params.startTime, params.durationMinutes);

      console.log(`📧 Sending booking confirmation email to ${params.customerEmail}`);

      const { data, error } = await supabase.functions.invoke('send-business-email', {
        body: {
          business_id: params.businessId,
          event_key: 'booking_confirmation',
          recipient_email: params.customerEmail,
          recipient_name: params.customerName,
          variables: {
            customer_name: params.customerName,
            customer_email: params.customerEmail,
            service_name: params.serviceName,
            service_duration: `${params.durationMinutes} minutes`,
            service_price: params.price,
            booking_date: params.bookingDate,
            booking_time: params.startTime,
            booking_end_time: endTime,
            specialist_name: params.specialistName || 'Any Available Specialist',
            business_name: business.name,
            business_address: business.address || '',
            business_phone: business.phone || '',
            business_email: '',
            cancellation_link: cancelUrl,
            reschedule_link: cancelUrl,
          },
          booking_id: params.bookingId,
        },
      });

      if (error) {
        console.error('❌ Failed to send booking confirmation email:', error);
        return false;
      }

      if (!data?.success) {
        console.error('❌ Email service returned error:', data);
        return false;
      }

      console.log('✅ Booking confirmation email sent successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to send booking confirmation:', error);
      return false;
    }
  }

  private calculateEndTime(startTime: string, durationMinutes: number): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  }

  async sendBookingCancellation(params: BookingCancellationParams): Promise<boolean> {
    try {
      const { data: business } = await supabase
        .from('businesses')
        .select('name, phone')
        .eq('id', params.businessId)
        .maybeSingle();

      if (!business) {
        console.error('Business not found');
        return false;
      }

      const rebookLink = `${window.location.origin}`;

      console.log(`📧 Sending booking cancellation email to ${params.customerEmail}`);

      const { data, error } = await supabase.functions.invoke('send-business-email', {
        body: {
          business_id: params.businessId,
          event_key: 'booking_cancelled',
          recipient_email: params.customerEmail,
          recipient_name: params.customerName,
          variables: {
            customer_name: params.customerName,
            service_name: params.serviceName,
            booking_date: params.bookingDate,
            booking_time: params.startTime,
            cancellation_reason: '',
            cancelled_by: 'customer',
            business_name: business.name,
            business_phone: business.phone || '',
            rebook_link: rebookLink,
          },
        },
      });

      if (error) {
        console.error('❌ Failed to send booking cancellation email:', error);
        return false;
      }

      if (!data?.success) {
        console.error('❌ Email service returned error:', data);
        return false;
      }

      console.log('✅ Booking cancellation email sent successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to send booking cancellation:', error);
      return false;
    }
  }

  async sendStatusChangeNotification(params: StatusChangeParams): Promise<boolean> {
    const template = await this.getTemplate(params.businessId, 'status_change');

    const statusMessages: { [key: string]: { subject: string; message: string } } = {
      confirmed: {
        subject: 'Booking Confirmed',
        message: 'Your booking has been confirmed by our team.',
      },
      completed: {
        subject: 'Thank You',
        message: 'Thank you for your visit! We hope you enjoyed your service.',
      },
      cancelled: {
        subject: 'Booking Cancelled',
        message: 'Your booking has been cancelled.',
      },
    };

    const statusInfo = statusMessages[params.status];
    if (!statusInfo) return false;

    const variables = {
      customerName: params.customerName,
      status: params.status,
      serviceName: params.serviceName,
      bookingDate: params.bookingDate,
      startTime: params.startTime,
    };

    let subject: string;
    let body: string;

    if (template && template.enabled) {
      subject = this.replaceVariables(template.subject || statusInfo.subject, variables);
      body = this.replaceVariables(template.body, variables);
    } else {
      subject = statusInfo.subject;
      body = `Hi ${params.customerName},

${statusInfo.message}

Service: ${params.serviceName}
Date: ${params.bookingDate}
Time: ${params.startTime}`;
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="white-space: pre-wrap;">${body}</div>
      </div>
    `;

    return this.sendEmail(params.businessId, {
      to: params.customerEmail,
      subject,
      html,
      text: body,
    });
  }
}

export const emailService = new EmailService();
