/**
 * English defaults of the booking-page texts a shop can customize (Settings >
 * Booking Form). A custom text equal to one of these is "not customized", so
 * the page shows the translation in the shop's language instead.
 */
import type { BookingFormCustomization } from '../hooks/useBookingCustomization';

export const DEFAULT_CUSTOMIZATION: Partial<BookingFormCustomization> = {
  welcome_step: {
    title: "Welcome! Let's get you booked",
    subtitle: "Choose your preferred service and time",
    buttonText: "Get Started",
    bookingButtonText: "Book an Appointment",
    giftCardButtonText: "Purchase a Gift Card",
    showBookingButton: true,
    showGiftCardButton: true,
    showAccountButton: true
  },
  service_step: {
    title: "Choose Your Service",
    subtitle: "Select the service you would like to book",
    buttonText: "Continue"
  },
  duration_step: {
    title: "Select Duration",
    subtitle: "How long would you like your appointment?",
    buttonText: "Continue"
  },
  specialist_step: {
    title: "Choose Your Specialist",
    subtitle: "Select your preferred specialist or let us choose for you",
    buttonText: "Continue",
    anySpecialistText: "Any Available Specialist"
  },
  datetime_step: {
    title: "Select Date & Time",
    subtitle: "Choose your preferred appointment date and time",
    buttonText: "Continue"
  },
  details_step: {
    title: "Your Details",
    subtitle: "Please provide your contact information",
    buttonText: "Continue",
    labels: {
      name: "Full Name",
      email: "Email Address",
      phone: "Phone Number",
      notes: "Additional Notes (Optional)"
    }
  },
  addons_step: {
    title: "Enhance Your Experience",
    subtitle: "Add optional products or services",
    buttonText: "Continue",
    skipButtonText: "Skip Add-ons"
  },
  payment_step: {
    title: "Payment",
    subtitle: "Complete your booking",
    buttonText: "Confirm Booking"
  }
};

function collectStrings(value: unknown, into: Set<string>): Set<string> {
  if (typeof value === 'string') into.add(value);
  else if (value && typeof value === 'object') Object.values(value).forEach((child) => collectStrings(child, into));
  return into;
}

export const DEFAULT_CUSTOM_TEXTS: ReadonlySet<string> = collectStrings(DEFAULT_CUSTOMIZATION, new Set());
