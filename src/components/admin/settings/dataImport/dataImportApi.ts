import { supabase } from '../../../../lib/supabase';
import type { BookingImportRow, CatalogLookup, CustomerImportRow, TimeBlockImportRow } from '../../../../lib/dataImport/buildRows';

export interface SaveSummary {
  saved: number;
  failed: string[];
}

const CUSTOMER_BATCH = 200;

export async function loadCatalog(businessId: string): Promise<CatalogLookup> {
  const [services, specialists] = await Promise.all([
    supabase.from('services').select('id, name, service_durations(id, duration_minutes)').eq('business_id', businessId),
    supabase.from('specialists').select('id, name').eq('business_id', businessId).eq('is_active', true),
  ]);
  if (services.error) throw services.error;
  if (specialists.error) throw specialists.error;
  type ServiceRow = { id: string; name: string; service_durations: { id: string; duration_minutes: number }[] | null };
  return {
    services: ((services.data ?? []) as ServiceRow[]).map((s) => ({
      id: s.id,
      name: s.name,
      durations: (s.service_durations ?? [])
        .map((d) => ({ id: d.id, minutes: d.duration_minutes }))
        .sort((a, b) => a.minutes - b.minutes),
    })),
    specialists: (specialists.data ?? []) as { id: string; name: string }[],
  };
}

/** Existing customers (same email) are kept as they are. */
export async function saveCustomers(businessId: string, rows: CustomerImportRow[]): Promise<SaveSummary> {
  const failed: string[] = [];
  let saved = 0;
  for (let i = 0; i < rows.length; i += CUSTOMER_BATCH) {
    const batch = rows.slice(i, i + CUSTOMER_BATCH).map((row) => ({ business_id: businessId, ...row }));
    const { error } = await supabase.from('customers').upsert(batch, { onConflict: 'business_id,email', ignoreDuplicates: true });
    if (error) failed.push(`Customers ${i + 1}–${i + batch.length}: ${error.message}`);
    else saved += batch.length;
  }
  return { saved, failed };
}

/**
 * One insert per appointment so a clash only skips that row (the booking guard
 * checks therapists, breaks and closures). channel 'import' = no confirmation
 * emails, only the day-before reminder.
 */
export async function saveBookings(
  businessId: string,
  rows: BookingImportRow[],
  onProgress: (done: number) => void,
): Promise<SaveSummary> {
  await saveCustomers(businessId, uniqueCustomers(rows));
  const failed: string[] = [];
  let saved = 0;
  for (const [index, row] of rows.entries()) {
    const { error } = await supabase.from('bookings').insert({
      business_id: businessId,
      ...row,
      status: 'confirmed',
      payment_status: 'pending',
      channel: 'import',
    });
    if (error) {
      const reason = error.message.includes('SLOT_UNAVAILABLE') ? 'time is taken or the shop is closed' : error.message;
      failed.push(`${row.booking_date} ${row.start_time} ${row.customer_name}: ${reason}`);
    } else {
      saved += 1;
    }
    onProgress(index + 1);
  }
  return { saved, failed };
}

export async function saveTimeBlocks(businessId: string, rows: TimeBlockImportRow[]): Promise<SaveSummary> {
  const { error } = await supabase.from('time_blocks').insert(rows.map((row) => ({ business_id: businessId, ...row })));
  return error ? { saved: 0, failed: [error.message] } : { saved: rows.length, failed: [] };
}

function uniqueCustomers(rows: BookingImportRow[]): CustomerImportRow[] {
  const byEmail = new Map<string, CustomerImportRow>();
  for (const row of rows) {
    if (!byEmail.has(row.customer_email)) {
      byEmail.set(row.customer_email, { name: row.customer_name, email: row.customer_email, phone: row.customer_phone || null, newsletter_status: null });
    }
  }
  return [...byEmail.values()];
}
