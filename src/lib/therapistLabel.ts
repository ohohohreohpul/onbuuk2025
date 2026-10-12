/** Who does the treatment: "Anna", or "Anna & Ben · Couple" for couple bookings. */
export interface TherapistAssignment {
  specialist_id: string | null;
  partner_specialist_id?: string | null;
  is_pair_booking?: boolean | null;
}

export function therapistLabel(booking: TherapistAssignment, names: Map<string, string>): string {
  const people = [booking.specialist_id, booking.partner_specialist_id]
    .map((id) => (id ? names.get(id) : undefined))
    .filter((name): name is string => Boolean(name));
  const base = people.length ? people.join(' & ') : 'Any specialist';
  return booking.is_pair_booking ? `${base} · Couple` : base;
}
