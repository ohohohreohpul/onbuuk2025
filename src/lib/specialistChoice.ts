/**
 * Per-shop switch: may customers pick their therapist on the booking page?
 * Off = the shop assigns staff itself; every online booking is "anyone" and the
 * booking guard picks a free, on-shift therapist.
 * Stored in site_settings (business_id, key) like the other booking settings.
 */
export const SPECIALIST_CHOICE_KEY = 'allowSpecialistChoice';

export function isSpecialistChoiceAllowed(value: string | null | undefined): boolean {
  if (!value) return true;
  return value.replace(/"/g, '').trim().toLowerCase() !== 'false';
}

export function serializeSpecialistChoice(isAllowed: boolean): string {
  return isAllowed ? 'true' : 'false';
}
