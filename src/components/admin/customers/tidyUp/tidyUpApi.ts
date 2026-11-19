import { supabase } from '../../../../lib/supabase';
import { pairKey } from './duplicateGroups';

/** Pairs the shop marked "not the same person", as pairKey()s. */
export async function loadDismissedPairs(businessId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('customer_duplicate_dismissals')
    .select('customer_a, customer_b')
    .eq('business_id', businessId);
  if (error) throw new Error(error.message);
  return new Set(((data ?? []) as { customer_a: string; customer_b: string }[]).map((row) => pairKey(row.customer_a, row.customer_b)));
}

export async function dismissDuplicates(customerIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('dismiss_customer_duplicates', { p_customer_ids: customerIds });
  if (error) throw new Error(error.message);
}

export interface MergeChoice {
  keepId: string;
  otherIds: string[];
  name: string;
  email: string;
  phone: string | null;
}

export async function mergeCustomers(choice: MergeChoice): Promise<void> {
  const { error } = await supabase.rpc('merge_customers', {
    p_keep_id: choice.keepId,
    p_other_ids: choice.otherIds,
    p_name: choice.name,
    p_email: choice.email,
    p_phone: choice.phone,
  });
  if (error) throw new Error(error.message);
}
