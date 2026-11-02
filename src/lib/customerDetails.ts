/** What the customer enters in the booking form's details step. */
export interface CustomerDetails {
  name: string;
  email: string;
  phone: string;
  notes: string;
  /** YYYY-MM-DD, or '' when not given. */
  birthday: string;
  newsletterOptIn: boolean;
}

export const EMPTY_CUSTOMER_DETAILS: CustomerDetails = {
  name: '',
  email: '',
  phone: '',
  notes: '',
  birthday: '',
  newsletterOptIn: false,
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const OLDEST_BIRTH_YEAR = 1900;

/** A birthday the database accepts: a real past date, not before 1900. */
export function isValidBirthday(value: string, today: Date = new Date()): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  return date.getUTCFullYear() >= OLDEST_BIRTH_YEAR && date.getTime() <= today.getTime();
}

/** Columns for a bookings insert; the bookings trigger copies them onto the customer. */
export function marketingBookingFields(details: CustomerDetails): { customer_birthday: string | null; newsletter_opt_in: boolean } {
  return {
    customer_birthday: isValidBirthday(details.birthday) ? details.birthday : null,
    newsletter_opt_in: details.newsletterOptIn,
  };
}
