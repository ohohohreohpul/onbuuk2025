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

/** One "also known as" value: `key` is what the database matches on and what removing needs. */
export interface CustomerAlias {
  kind: 'email' | 'phone';
  key: string;
  value: string;
}

/** "Also known as" emails and phone numbers, per customer id (one customer if `customerId` is given). */
export async function loadCustomerAliases(businessId: string, customerId?: string): Promise<Map<string, CustomerAlias[]>> {
  let emailQuery = supabase.from('customer_email_aliases').select('customer_id, email_key').eq('business_id', businessId);
  let phoneQuery = supabase.from('customer_phone_aliases').select('customer_id, phone_key, phone').eq('business_id', businessId);
  if (customerId) {
    emailQuery = emailQuery.eq('customer_id', customerId);
    phoneQuery = phoneQuery.eq('customer_id', customerId);
  }
  const [emailResult, phoneResult] = await Promise.all([emailQuery, phoneQuery]);
  if (emailResult.error) throw new Error(emailResult.error.message);
  if (phoneResult.error) throw new Error(phoneResult.error.message);

  const rows: [string, CustomerAlias][] = [
    ...((emailResult.data ?? []) as { customer_id: string; email_key: string }[])
      .map((row): [string, CustomerAlias] => [row.customer_id, { kind: 'email', key: row.email_key, value: row.email_key }]),
    ...((phoneResult.data ?? []) as { customer_id: string; phone_key: string; phone: string }[])
      .map((row): [string, CustomerAlias] => [row.customer_id, { kind: 'phone', key: row.phone_key, value: row.phone }]),
  ];
  const byCustomer = new Map<string, CustomerAlias[]>();
  for (const [id, alias] of rows) byCustomer.set(id, [...(byCustomer.get(id) ?? []), alias]);
  return byCustomer;
}

export async function removeCustomerAlias(customerId: string, kind: 'email' | 'phone', key: string): Promise<void> {
  const { error } = await supabase.rpc('remove_customer_alias', { p_customer_id: customerId, p_kind: kind, p_key: key });
  if (error) throw new Error(error.message);
}
