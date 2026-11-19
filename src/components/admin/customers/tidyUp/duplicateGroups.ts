/**
 * Finds customers that are probably the same person (Planity-style tidy-up):
 * same email (ignoring case/spaces), same phone (German formats normalised),
 * or same full name. Pairs the shop marked "not the same person" never link.
 */

export interface TidyCustomer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  blocked_at?: string | null;
  /** "Also known as": emails and phone numbers remembered from earlier merges. */
  extraEmails?: string[];
  extraPhones?: string[];
}

export type DuplicateReason = 'email' | 'phone' | 'name';

export interface DuplicateGroup {
  customers: TidyCustomer[];
  reasons: DuplicateReason[];
  /** Email or phone match: very likely one person. Name only: the shop should check. */
  isLikely: boolean;
}

/** Shared keys used by more customers than this are junk data (e.g. "000000"), not a person. */
const MAX_BUCKET = 20;
const MIN_NAME_TOKENS = 2;

export function emailKey(email: string | null | undefined): string | null {
  return email?.trim().toLowerCase() || null;
}

/** Same rules as private.phone_key() in the database: +49 176 123, 0049…, 0176-123 → 0176123. */
export function phoneKey(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.trim().startsWith('+') ? `00${phone.replace(/\D/g, '')}` : phone.replace(/\D/g, '');
  if (digits.startsWith('0049')) digits = `0${digits.slice(4)}`;
  return digits.length >= 6 ? digits : null;
}

/** "Müller, Anna" and "anna  müller" match; a first name alone ("Anna") never does. */
export function nameKey(name: string | null | undefined): string | null {
  const tokens = (name ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-zß฀-๿]+/)
    .filter(Boolean)
    .sort();
  return tokens.length >= MIN_NAME_TOKENS ? tokens.join(' ') : null;
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function findDuplicateGroups(customers: TidyCustomer[], dismissedPairs: Set<string>): DuplicateGroup[] {
  const parent = new Map(customers.map((customer) => [customer.id, customer.id]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root) as string;
    parent.set(id, root);
    return root;
  };
  const edgeReasons = new Map<string, Set<DuplicateReason>>();

  const keys = (values: (string | null | undefined)[], keyOf: (value: string | null | undefined) => string | null) =>
    [...new Set(values.map(keyOf).filter((key): key is string => Boolean(key)))];
  const signals: [DuplicateReason, (customer: TidyCustomer) => string[]][] = [
    ['email', (customer) => keys([customer.email, ...(customer.extraEmails ?? [])], emailKey)],
    ['phone', (customer) => keys([customer.phone, ...(customer.extraPhones ?? [])], phoneKey)],
    ['name', (customer) => keys([customer.name], nameKey)],
  ];
  for (const [reason, keyOf] of signals) {
    const buckets = new Map<string, string[]>();
    for (const customer of customers) {
      for (const key of keyOf(customer)) buckets.set(key, [...(buckets.get(key) ?? []), customer.id]);
    }
    for (const ids of buckets.values()) {
      if (ids.length < 2 || ids.length > MAX_BUCKET) continue;
      ids.forEach((a, index) => ids.slice(index + 1).forEach((b) => {
        const pair = pairKey(a, b);
        if (dismissedPairs.has(pair)) return;
        parent.set(find(a), find(b));
        edgeReasons.set(pair, new Set([...(edgeReasons.get(pair) ?? []), reason]));
      }));
    }
  }

  const members = new Map<string, TidyCustomer[]>();
  for (const customer of customers) {
    const root = find(customer.id);
    members.set(root, [...(members.get(root) ?? []), customer]);
  }

  const reasonOrder: DuplicateReason[] = ['email', 'phone', 'name'];
  return [...members.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      const ids = new Set(group.map((customer) => customer.id));
      const reasons = new Set<DuplicateReason>();
      for (const [pair, pairReasons] of edgeReasons) {
        const [a, b] = pair.split('|');
        if (ids.has(a) && ids.has(b)) pairReasons.forEach((reason) => reasons.add(reason));
      }
      const sortedReasons = reasonOrder.filter((reason) => reasons.has(reason));
      return {
        customers: [...group].sort((a, b) => a.name.localeCompare(b.name)),
        reasons: sortedReasons,
        isLikely: reasons.has('email') || reasons.has('phone'),
      };
    })
    .sort((a, b) => Number(b.isLikely) - Number(a.isLikely) || b.customers.length - a.customers.length);
}
