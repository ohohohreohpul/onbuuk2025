/**
 * Shops type their address as one line ("Musterstraße 1, 12345 Berlin").
 * The e-invoice wants street, postcode, city and country separately.
 */

export interface PostalAddress {
  street: string | null;
  postcode: string | null;
  city: string | null;
  country: string;
}

const POSTCODE_CITY = /^(?:D-)?(\d{4,5})\s+(.+)$/i;

export function parsePostalAddress(value: string | null | undefined, country = 'DE'): PostalAddress {
  const parts = (value ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  const cityIndex = parts.findIndex((part) => POSTCODE_CITY.test(part));
  if (cityIndex === -1) {
    return { street: parts[0] ?? null, postcode: null, city: parts[1] ?? null, country };
  }

  const [, postcode, city] = parts[cityIndex].match(POSTCODE_CITY) as RegExpMatchArray;
  const street = parts.slice(0, cityIndex).find((part) => /\d/.test(part)) ?? parts[0] ?? null;
  return { street: street === parts[cityIndex] ? null : street, postcode, city, country };
}
