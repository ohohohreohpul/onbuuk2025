export interface StoredDuration {
  id: string;
  duration_minutes: number;
  price_cents: number;
}

export interface EditedDuration {
  /** Set for prices that already exist; missing for newly added rows. */
  id?: string;
  duration_minutes: number;
  price_cents: number;
}

export interface DurationChanges {
  updates: StoredDuration[];
  inserts: EditedDuration[];
  deletes: StoredDuration[];
}

/**
 * Diff the edited price list against what is stored. Existing rows are updated
 * in place (same id), so bookings and vouchers that point at them stay intact.
 */
export function planDurationChanges(stored: StoredDuration[], edited: EditedDuration[]): DurationChanges {
  const byId = new Map(stored.map((row) => [row.id, row]));
  const keptIds = new Set(edited.flatMap((row) => (row.id && byId.has(row.id) ? [row.id] : [])));

  const updates = edited.flatMap((row) => {
    const before = row.id ? byId.get(row.id) : undefined;
    if (!before) return [];
    const changed = before.duration_minutes !== row.duration_minutes || before.price_cents !== row.price_cents;
    return changed ? [{ id: before.id, duration_minutes: row.duration_minutes, price_cents: row.price_cents }] : [];
  });
  const inserts = edited.filter((row) => !row.id || !byId.has(row.id));
  const deletes = stored.filter((row) => !keptIds.has(row.id));
  return { updates, inserts, deletes };
}

/** Two rows with the same length would show up twice in the booking flow. */
export function duplicateMinutes(edited: EditedDuration[]): number | null {
  const seen = new Set<number>();
  for (const row of edited) {
    if (seen.has(row.duration_minutes)) return row.duration_minutes;
    seen.add(row.duration_minutes);
  }
  return null;
}
