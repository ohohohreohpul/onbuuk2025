export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  THB: '฿',
  AUD: 'A$',
  CAD: 'C$',
  JPY: '¥',
  CNY: '¥',
  INR: '₹',
  KRW: '₩',
  MXN: 'MX$',
  BRL: 'R$',
  ZAR: 'R',
  SGD: 'S$',
  NZD: 'NZ$',
  CHF: 'CHF',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zł',
  CZK: 'Kč',
  HUF: 'Ft',
  RON: 'lei',
  TRY: '₺',
  RUB: '₽',
  AED: 'د.إ',
  SAR: 'ر.س',
  QAR: 'ر.ق',
  KWD: 'د.ك',
  BHD: 'د.ب',
  OMR: 'ر.ع',
  JOD: 'د.ا',
  ILS: '₪',
  EGP: 'E£',
  MAD: 'د.م',
  NGN: '₦',
  KES: 'KSh',
  GHS: 'GH₵',
  PHP: '₱',
  IDR: 'Rp',
  MYR: 'RM',
  VND: '₫',
  PKR: '₨',
  BDT: '৳',
  LKR: 'Rs',
  MMK: 'K',
  ARS: 'AR$',
  CLP: 'CL$',
  COP: 'CO$',
  PEN: 'S/',
  UYU: '$U',
  VEF: 'Bs',
};

export const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  THB: 'Thai Baht',
  AUD: 'Australian Dollar',
  CAD: 'Canadian Dollar',
  JPY: 'Japanese Yen',
  CNY: 'Chinese Yuan',
  INR: 'Indian Rupee',
  KRW: 'South Korean Won',
  MXN: 'Mexican Peso',
  BRL: 'Brazilian Real',
  ZAR: 'South African Rand',
  SGD: 'Singapore Dollar',
  NZD: 'New Zealand Dollar',
  CHF: 'Swiss Franc',
  SEK: 'Swedish Krona',
  NOK: 'Norwegian Krone',
  DKK: 'Danish Krone',
  PLN: 'Polish Złoty',
  CZK: 'Czech Koruna',
  HUF: 'Hungarian Forint',
  RON: 'Romanian Leu',
  TRY: 'Turkish Lira',
  RUB: 'Russian Ruble',
  AED: 'UAE Dirham',
  SAR: 'Saudi Riyal',
  QAR: 'Qatari Riyal',
  KWD: 'Kuwaiti Dinar',
  BHD: 'Bahraini Dinar',
  OMR: 'Omani Rial',
  JOD: 'Jordanian Dinar',
  ILS: 'Israeli Shekel',
  EGP: 'Egyptian Pound',
  MAD: 'Moroccan Dirham',
  NGN: 'Nigerian Naira',
  KES: 'Kenyan Shilling',
  GHS: 'Ghanaian Cedi',
  PHP: 'Philippine Peso',
  IDR: 'Indonesian Rupiah',
  MYR: 'Malaysian Ringgit',
  VND: 'Vietnamese Dong',
  PKR: 'Pakistani Rupee',
  BDT: 'Bangladeshi Taka',
  LKR: 'Sri Lankan Rupee',
  MMK: 'Myanmar Kyat',
  ARS: 'Argentine Peso',
  CLP: 'Chilean Peso',
  COP: 'Colombian Peso',
  PEN: 'Peruvian Sol',
  UYU: 'Uruguayan Peso',
  VEF: 'Venezuelan Bolívar',
};

const ZERO_DECIMAL_CURRENCIES = ['JPY', 'KRW', 'VND', 'CLP', 'IDR'];

export function formatCurrency(cents: number, currencyCode: string = 'USD'): string {
  const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;

  if (ZERO_DECIMAL_CURRENCIES.includes(currencyCode)) {
    return `${symbol}${Math.round(cents / 100).toLocaleString()}`;
  }

  const amount = (cents / 100).toFixed(2);
  return `${symbol}${parseFloat(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function getCurrencySymbol(currencyCode: string = 'USD'): string {
  return CURRENCY_SYMBOLS[currencyCode] || currencyCode;
}

export function getCurrencyName(currencyCode: string = 'USD'): string {
  return CURRENCY_NAMES[currencyCode] || currencyCode;
}

export function isZeroDecimalCurrency(currencyCode: string): boolean {
  return ZERO_DECIMAL_CURRENCIES.includes(currencyCode);
}
