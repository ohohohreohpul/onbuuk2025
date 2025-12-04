import { supabase } from './supabase';

interface WorkingHour {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface TimeBlock {
  start_time: string;
  end_time: string;
}

interface Booking {
  start_time: string;
  booking_date: string;
  duration_minutes: number;
}

interface Service {
  buffer_before: number;
  buffer_after: number;
}

export class AvailabilityService {
  async getAvailableTimeSlots(
    specialistId: string,
    date: string,
    durationMinutes: number,
    serviceId: string
  ): Promise<string[]> {
    const dayOfWeek = new Date(date).getDay();

    const { data: service } = await supabase
      .from('services')
      .select('buffer_before, buffer_after')
      .eq('id', serviceId)
      .single();

    const bufferBefore = service?.buffer_before || 0;
    const bufferAfter = service?.buffer_after || 0;
    const totalDuration = durationMinutes + bufferBefore + bufferAfter;

    const { data: workingHours } = await supabase
      .from('working_hours')
      .select('*')
      .eq('specialist_id', specialistId)
      .eq('day_of_week', dayOfWeek)
      .single();

    if (!workingHours || !workingHours.is_available) {
      return [];
    }

    const { data: timeBlocks } = await supabase
      .from('time_blocks')
      .select('start_time, end_time')
      .eq('specialist_id', specialistId)
      .lte('start_time', `${date}T23:59:59`)
      .gte('end_time', `${date}T00:00:00`);

    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('start_time, booking_date, duration:service_durations(duration_minutes)')
      .eq('specialist_id', specialistId)
      .eq('booking_date', date)
      .neq('status', 'cancelled');

    const allTimeSlots = this.generateTimeSlots(
      workingHours.start_time,
      workingHours.end_time,
      30
    );

    const availableSlots = allTimeSlots.filter((slot) => {
      const slotStart = this.parseTime(slot);
      const slotEnd = slotStart + totalDuration * 60000;

      if (this.isBlockedByTimeBlock(slotStart, slotEnd, date, timeBlocks || [])) {
        return false;
      }

      if (this.isBlockedByBooking(slotStart, slotEnd, date, existingBookings || [], bufferBefore, bufferAfter)) {
        return false;
      }

      return true;
    });

    return availableSlots;
  }

  private generateTimeSlots(startTime: string, endTime: string, intervalMinutes: number): string[] {
    const slots: string[] = [];
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;

    for (let minutes = startTotalMinutes; minutes < endTotalMinutes; minutes += intervalMinutes) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    }

    return slots;
  }

  private parseTime(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    const today = new Date();
    today.setHours(hours, minutes, 0, 0);
    return today.getTime();
  }

  private isBlockedByTimeBlock(
    slotStart: number,
    slotEnd: number,
    date: string,
    timeBlocks: TimeBlock[]
  ): boolean {
    return timeBlocks.some((block) => {
      const blockStart = new Date(block.start_time).getTime();
      const blockEnd = new Date(block.end_time).getTime();

      const slotStartDate = new Date(`${date}T00:00:00`);
      slotStartDate.setTime(slotStartDate.getTime() + slotStart - slotStartDate.setHours(0, 0, 0, 0));

      const slotEndDate = new Date(`${date}T00:00:00`);
      slotEndDate.setTime(slotEndDate.getTime() + slotEnd - slotEndDate.setHours(0, 0, 0, 0));

      return (
        (slotStartDate.getTime() >= blockStart && slotStartDate.getTime() < blockEnd) ||
        (slotEndDate.getTime() > blockStart && slotEndDate.getTime() <= blockEnd) ||
        (slotStartDate.getTime() <= blockStart && slotEndDate.getTime() >= blockEnd)
      );
    });
  }

  private isBlockedByBooking(
    slotStart: number,
    slotEnd: number,
    date: string,
    bookings: any[],
    bufferBefore: number,
    bufferAfter: number
  ): boolean {
    return bookings.some((booking) => {
      const [bookingHour, bookingMinute] = booking.start_time.split(':').map(Number);
      const bookingStartMs = this.parseTime(booking.start_time);

      const durationMinutes = booking.duration?.duration_minutes || 60;
      const bookingEndMs = bookingStartMs + (durationMinutes + bufferBefore + bufferAfter) * 60000;

      return (
        (slotStart >= bookingStartMs && slotStart < bookingEndMs) ||
        (slotEnd > bookingStartMs && slotEnd <= bookingEndMs) ||
        (slotStart <= bookingStartMs && slotEnd >= bookingEndMs)
      );
    });
  }

  async getAllAvailableTimeSlotsForDate(
    date: string,
    serviceId: string,
    durationMinutes: number,
    businessId: string
  ): Promise<{ [specialistId: string]: string[] }> {
    const { data: specialists } = await supabase
      .from('specialists')
      .select('id')
      .eq('business_id', businessId)
      .eq('is_active', true);

    if (!specialists) return {};

    const availabilityMap: { [specialistId: string]: string[] } = {};

    for (const specialist of specialists) {
      const slots = await this.getAvailableTimeSlots(
        specialist.id,
        date,
        durationMinutes,
        serviceId
      );
      availabilityMap[specialist.id] = slots;
    }

    return availabilityMap;
  }
}

export const availabilityService = new AvailabilityService();
