import { supabase } from './supabase';

/**
 * Live customer statistics from the `customer_stats` view (derived from bookings).
 * Every booking falls into exactly one bucket:
 * total_count = visits_count + no_show_count + cancelled_count + upcoming_count.
 */
export interface CustomerStats {
  customer_id: string;
  total_count: number;
  visits_count: number;
  no_show_count: number;
  cancelled_count: number;
  upcoming_count: number;
  spent_cents: number;
  first_visit_date: string | null;
  last_visit_date: string | null;
}

/** A customer counts as a regular from this many attended visits. */
export const REGULAR_MIN_VISITS = 2;

export const EMPTY_CUSTOMER_STATS: Omit<CustomerStats, 'customer_id'> = {
  total_count: 0,
  visits_count: 0,
  no_show_count: 0,
  cancelled_count: 0,
  upcoming_count: 0,
  spent_cents: 0,
  first_visit_date: null,
  last_visit_date: null,
};

const STATS_COLUMNS =
  'customer_id, total_count, visits_count, no_show_count, cancelled_count, upcoming_count, spent_cents, first_visit_date, last_visit_date';

export async function fetchCustomerStatsForBusiness(businessId: string): Promise<Map<string, CustomerStats>> {
  const { data, error } = await supabase
    .from('customer_stats')
    .select(STATS_COLUMNS)
    .eq('business_id', businessId);

  if (error) {
    console.error('Could not load customer statistics:', error);
    throw new Error('Customer statistics are unavailable right now.');
  }
  return new Map(((data || []) as CustomerStats[]).map((row) => [row.customer_id, row]));
}

export async function fetchCustomerStats(customerId: string): Promise<CustomerStats> {
  const { data, error } = await supabase
    .from('customer_stats')
    .select(STATS_COLUMNS)
    .eq('customer_id', customerId)
    .maybeSingle();

  if (error) {
    console.error('Could not load customer statistics:', error);
    throw new Error('Customer statistics are unavailable right now.');
  }
  return (data as CustomerStats | null) ?? { customer_id: customerId, ...EMPTY_CUSTOMER_STATS };
}

/** Format a plain `YYYY-MM-DD` date without the UTC day shift of `new Date('YYYY-MM-DD')`. */
export function formatCalendarDate(value: string | null): string {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
