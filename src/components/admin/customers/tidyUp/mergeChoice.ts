import type { MergeChoice } from './tidyUpApi';
import type { TidyCustomer } from './duplicateGroups';

export type MergeCandidate = TidyCustomer & { visits_count?: number };

export interface MergeSelection {
  includedIds: string[];
  name: string;
  email: string;
  phone: string | null;
}

/** Each value once; `keyOf` decides when two values count as the same (emails: ignoring case). */
const distinct = (values: (string | null | undefined)[], keyOf: (value: string) => string = (value) => value) => {
  const seen = new Map<string, string>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed && !seen.has(keyOf(trimmed))) seen.set(keyOf(trimmed), trimmed);
  }
  return [...seen.values()];
};

/** The options the popup offers: every different name, email and phone of the ticked customers. */
export function mergeOptions(customers: MergeCandidate[], includedIds: string[]) {
  // Most visits first, so the regular customer's spelling is the one offered.
  const included = customers.filter((customer) => includedIds.includes(customer.id))
    .sort((a, b) => (b.visits_count ?? 0) - (a.visits_count ?? 0));
  return {
    names: distinct(included.map((customer) => customer.name)),
    emails: distinct(included.map((customer) => customer.email), (email) => email.toLowerCase()),
    phones: distinct(included.map((customer) => customer.phone)),
  };
}

/** Start with the customer who visited most: their name, email and phone. */
export function defaultSelection(customers: MergeCandidate[]): MergeSelection {
  const main = [...customers].sort((a, b) => (b.visits_count ?? 0) - (a.visits_count ?? 0))[0];
  return {
    includedIds: customers.map((customer) => customer.id),
    name: main.name.trim(),
    email: main.email.trim(),
    phone: main.phone?.trim() || customers.find((customer) => customer.phone?.trim())?.phone?.trim() || null,
  };
}

/** Keeps the customer whose email stays the main one, so no email has to move. */
export function mergeRequest(customers: MergeCandidate[], selection: MergeSelection): MergeChoice | null {
  const included = customers.filter((customer) => selection.includedIds.includes(customer.id));
  if (included.length < 2) return null;
  const keep = included.find((customer) => customer.email.trim() === selection.email.trim())
    ?? included.find((customer) => customer.email.trim().toLowerCase() === selection.email.trim().toLowerCase())
    ?? included[0];
  return {
    keepId: keep.id,
    otherIds: included.filter((customer) => customer.id !== keep.id).map((customer) => customer.id),
    name: selection.name,
    email: keep.email,
    phone: selection.phone,
  };
}
