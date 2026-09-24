/**
 * Parses a gift card import CSV into validated rows.
 *
 * One file can mix two kinds of cards:
 *   type=value         money card: `value` is the balance
 *   type=service_pass  visit pass: `pass` names a Service Pass offer,
 *                      `visits` is how many visits are left (defaults to the offer's),
 *                      `value` is the price paid (defaults to the offer's price)
 *
 * Nothing is written here; every row is checked first so a typo never creates a broken card.
 */

export interface ServicePassOffer {
  id: string;
  name: string;
  service_id: string;
  duration_id: string;
  visit_count: number;
  price_cents: number;
  expiry_days: number | null;
  is_active: boolean;
}

interface BaseRow {
  rowNumber: number;
  code: string | null; // null = auto-generate
  recipientEmail: string | null;
  expiresAt: string | null;
}

export interface ValueCardRow extends BaseRow {
  type: 'value';
  valueCents: number;
}

export interface ServicePassRow extends BaseRow {
  type: 'service_pass';
  offer: ServicePassOffer;
  visitsLeft: number;
  visitsTotal: number;
  pricePaidCents: number;
}

export type GiftCardImportRow = ValueCardRow | ServicePassRow;

export interface ParseResult {
  rows: GiftCardImportRow[];
  errors: string[];
}

export const MAX_IMPORT_ROWS = 2000;
const MAX_VISITS = 100;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const GERMAN_DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;

/** Accept 2027-12-31 and the German 31.12.2027. */
const toIsoDate = (raw: string): string | null => {
  if (DATE_ONLY.test(raw)) return raw;
  const match = raw.match(GERMAN_DATE);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : null;
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE = /^[A-Za-z0-9-]{4,40}$/;

const TYPE_ALIASES: Record<string, GiftCardImportRow['type']> = {
  '': 'value',
  value: 'value',
  gift_card: 'value',
  giftcard: 'value',
  service_pass: 'service_pass',
  'service pass': 'service_pass',
  pass: 'service_pass',
};

/** Split one CSV line, honouring quoted fields and escaped quotes (""). */
export function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && inQuotes && line[i + 1] === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((value) => value.trim());
}

/** Accepts 12.50, 12,50 (German) and 1.234,50. */
export function parseMoneyToCents(raw: string): number | null {
  const cleaned = raw.replace(/[€$£\s]/g, '');
  if (!cleaned) return null;
  const normalized = /,\d{1,2}$/.test(cleaned) ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
}

const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

/** A date-only expiry means "valid through the end of that day" in local time. */
const endOfLocalDay = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 23, 59, 59);
  return date.getMonth() === month - 1 ? date.toISOString() : null;
};

const detectDelimiter = (headerLine: string) =>
  (headerLine.match(/;/g)?.length ?? 0) > (headerLine.match(/,/g)?.length ?? 0) ? ';' : ',';

interface ParseOptions {
  offers: ServicePassOffer[];
  defaultExpiryDays: number | null;
}

export function parseGiftCardCsv(csvText: string, { offers, defaultExpiryDays }: ParseOptions): ParseResult {
  const lines = csvText
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((line, index) => ({ text: line, rowNumber: index + 1 }))
    .filter(({ text }) => text.trim() && !text.trim().startsWith('#'));

  if (lines.length < 2) {
    return { rows: [], errors: ['The file needs a header row and at least one gift card row.'] };
  }
  if (lines.length - 1 > MAX_IMPORT_ROWS) {
    return { rows: [], errors: [`Please import at most ${MAX_IMPORT_ROWS} gift cards per file.`] };
  }

  const delimiter = detectDelimiter(lines[0].text);
  const headers = parseCsvLine(lines[0].text, delimiter).map((header) => header.toLowerCase());
  const hasValueColumn = headers.includes('value') || headers.includes('value_eur');
  const hasPassColumn = headers.includes('pass');
  if (!hasValueColumn && !hasPassColumn) {
    return { rows: [], errors: ['Missing column: add "value" (money cards) and/or "pass" (service passes).'] };
  }

  const offersByName = new Map(offers.map((offer) => [offer.name.trim().toLowerCase(), offer]));
  const offerNames = offers.filter((offer) => offer.is_active).map((offer) => `"${offer.name}"`).join(', ');
  const seenCodes = new Set<string>();
  const rows: GiftCardImportRow[] = [];
  const errors: string[] = [];

  for (const { text, rowNumber } of lines.slice(1)) {
    const values = parseCsvLine(text, delimiter);
    const cell = (name: string) => values[headers.indexOf(name)] ?? '';
    const fail = (message: string) => errors.push(`Row ${rowNumber}: ${message}`);

    const type = TYPE_ALIASES[cell('type').toLowerCase()];
    if (!type) {
      fail(`Unknown type "${cell('type')}". Use "value" or "service_pass".`);
      continue;
    }

    const code = cell('code') || null;
    if (code && !CODE.test(code)) {
      fail(`Code "${code}" must be 4–40 letters, numbers or dashes.`);
      continue;
    }
    if (code && seenCodes.has(code.toUpperCase())) {
      fail(`Code "${code}" appears more than once in this file.`);
      continue;
    }

    const recipientEmail = cell('recipient_email') || null;
    if (recipientEmail && !EMAIL.test(recipientEmail)) {
      fail(`"${recipientEmail}" is not a valid email address.`);
      continue;
    }

    const rawExpiry = cell('expires_at');
    const isoExpiry = rawExpiry ? toIsoDate(rawExpiry) : null;
    if (rawExpiry && !isoExpiry) {
      fail(`Expiry "${rawExpiry}" must be a date like 2027-12-31 or 31.12.2027.`);
      continue;
    }
    const explicitExpiry = isoExpiry ? endOfLocalDay(isoExpiry) : null;
    if (rawExpiry && !explicitExpiry) {
      fail(`Expiry "${rawExpiry}" is not a real date.`);
      continue;
    }

    const rawValue = cell('value') || cell('value_eur');
    const base = { rowNumber, code, recipientEmail };

    if (type === 'value') {
      const valueCents = parseMoneyToCents(rawValue);
      if (!valueCents) {
        fail('A money gift card needs a positive "value".');
        continue;
      }
      rows.push({
        ...base,
        type,
        valueCents,
        expiresAt: explicitExpiry ?? (defaultExpiryDays ? addDays(defaultExpiryDays) : null),
      });
    } else {
      const passName = cell('pass');
      const offer = offersByName.get(passName.toLowerCase());
      if (!passName) {
        fail('A service pass needs a "pass" name.');
        continue;
      }
      if (!offer) {
        fail(`No service pass called "${passName}".${offerNames ? ` Available: ${offerNames}.` : ' Create it under Service Passes first.'}`);
        continue;
      }

      const rawVisits = cell('visits');
      const visitsLeft = rawVisits ? Number(rawVisits) : offer.visit_count;
      if (!Number.isInteger(visitsLeft) || visitsLeft < 0 || visitsLeft > MAX_VISITS) {
        fail(`"visits" must be a whole number from 0 to ${MAX_VISITS}.`);
        continue;
      }

      const pricePaidCents = rawValue ? parseMoneyToCents(rawValue) : offer.price_cents;
      if (!pricePaidCents) {
        fail('"value" (price paid) must be a positive amount, or leave it empty to use the pass price.');
        continue;
      }

      rows.push({
        ...base,
        type,
        offer,
        visitsLeft,
        visitsTotal: Math.max(offer.visit_count, visitsLeft),
        pricePaidCents,
        expiresAt:
          explicitExpiry ??
          (offer.expiry_days ? addDays(offer.expiry_days) : defaultExpiryDays ? addDays(defaultExpiryDays) : null),
      });
    }

    if (code) seenCodes.add(code.toUpperCase());
  }

  return { rows, errors };
}

/** Values for the gift_cards insert, matching the card created from the admin UI. */
export function toGiftCardInsert(row: GiftCardImportRow, businessId: string, code: string) {
  const shared = {
    business_id: businessId,
    code,
    purchased_for_email: row.recipientEmail,
    expires_at: row.expiresAt,
  };

  if (row.type === 'value') {
    return {
      ...shared,
      card_type: 'value' as const,
      original_value_cents: row.valueCents,
      current_balance_cents: row.valueCents,
      purchase_price_cents: row.valueCents,
      status: 'active',
    };
  }

  return {
    ...shared,
    card_type: 'service_pass' as const,
    service_pass_offer_id: row.offer.id,
    service_pass_name: row.offer.name,
    service_id: row.offer.service_id,
    duration_id: row.offer.duration_id,
    original_visits: row.visitsTotal,
    remaining_visits: row.visitsLeft,
    purchase_price_cents: row.pricePaidCents,
    original_value_cents: 0,
    current_balance_cents: 0,
    status: row.visitsLeft === 0 ? 'fully_redeemed' : 'active',
  };
}
