import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

export interface GiftCardData {
  code: string;
  amount: number;
  cardType?: 'value' | 'service_pass';
  servicePassName?: string | null;
  visits?: number | null;
  durationMinutes?: number | null;
  designUrl: string | null;
  termsAndConditions: string | null;
  businessName: string;
  expiresAt: string | null;
  currencySymbol?: string;
  /** ISO currency (e.g. EUR); when set, amounts use the language's number format. */
  currencyCode?: string;
  language?: 'en' | 'de';
  /** Shown under the amount, e.g. "Gutscheinset Premium · 1 von 4". */
  note?: string | null;
}

type Rgb = [number, number, number];

// Warm, quiet palette that sits well next to most brand covers.
const INK: Rgb = [58, 51, 43];
const MUTED: Rgb = [120, 108, 95];
const ACCENT: Rgb = [156, 118, 80];
const PAPER: Rgb = [246, 243, 237];
const RULE: Rgb = [217, 206, 194];

const TEXT = {
  en: {
    value: 'Gift Card',
    pass: 'Treatment Voucher',
    code: 'Voucher code',
    validUntil: 'Valid until {date}',
    visitOne: '{count} visit',
    visitMany: '{count} visits',
    minutesEach: '{minutes} minutes each',
    terms: 'Terms & conditions',
    designMissing: 'Gift Card',
  },
  de: {
    value: 'Wertgutschein',
    pass: 'Behandlungsgutschein',
    code: 'Gutscheincode',
    validUntil: 'Gültig bis {date}',
    visitOne: '{count} Anwendung',
    visitMany: '{count} Anwendungen',
    minutesEach: 'je {minutes} Minuten',
    terms: 'Bedingungen',
    designMissing: 'Gutschein',
  },
} as const;

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));

/** jsPDF's built-in fonts have no narrow no-break space; plain spaces render reliably. */
const pdfSafe = (text: string) => text.replace(/[  ]/g, ' ');

function formatMoney(card: GiftCardData): string {
  const locale = card.language === 'de' ? 'de-DE' : 'en-US';
  if (card.currencyCode) {
    return pdfSafe(new Intl.NumberFormat(locale, { style: 'currency', currency: card.currencyCode }).format(card.amount));
  }
  const symbol = card.currencySymbol || '€';
  return `${symbol}${card.amount.toFixed(2)}`;
}

/** Remote images are fetched once and embedded; data URLs pass straight through. */
async function loadImage(url: string): Promise<{ data: string; format: 'JPEG' | 'PNG' } | null> {
  try {
    let dataUrl = url;
    if (!url.startsWith('data:')) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Image request failed (${response.status})`);
      const blob = await response.blob();
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    return { data: dataUrl, format: dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG' };
  } catch (error) {
    console.error('Gift card design could not be loaded:', error);
    return null;
  }
}

async function drawCard(pdf: jsPDF, card: GiftCardData, design: Awaited<ReturnType<typeof loadImage>>) {
  const t = TEXT[card.language === 'de' ? 'de' : 'en'];
  const isServicePass = card.cardType === 'service_pass';
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const half = pageWidth / 2;
  const left = half + 12;
  const textWidth = half - 24;

  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');

  // Left: the cover design, full bleed.
  if (design) {
    pdf.addImage(design.data, design.format, 0, 0, half, pageHeight, undefined, 'FAST');
  } else {
    pdf.setFillColor(...PAPER);
    pdf.rect(0, 0, half, pageHeight, 'F');
    pdf.setFont('times', 'normal');
    pdf.setFontSize(22);
    pdf.setTextColor(...INK);
    pdf.text(pdfSafe(card.businessName), half / 2, pageHeight / 2 - 6, { align: 'center' });
    pdf.setFont('times', 'italic');
    pdf.setFontSize(16);
    pdf.setTextColor(...ACCENT);
    pdf.text(t.designMissing, half / 2, pageHeight / 2 + 6, { align: 'center' });
  }

  // Right: details.
  let y = 20;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...MUTED);
  pdf.text(pdfSafe(card.businessName).toUpperCase(), left, y, { charSpace: 1.2 });
  y += 11;

  pdf.setFont('times', 'italic');
  pdf.setFontSize(20);
  pdf.setTextColor(...ACCENT);
  pdf.text(isServicePass ? t.pass : t.value, left, y);
  y += 4;
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.3);
  pdf.line(left, y, left + 40, y);
  y += 10;

  if (isServicePass) {
    pdf.setFont('times', 'normal');
    pdf.setFontSize(17);
    pdf.setTextColor(...INK);
    const nameLines = pdf.splitTextToSize(pdfSafe(card.servicePassName || t.pass), textWidth);
    pdf.text(nameLines, left, y);
    y += nameLines.length * 7;
    const visits = card.visits || 1;
    const entitlement = [
      fill(visits === 1 ? t.visitOne : t.visitMany, { count: visits }),
      card.durationMinutes ? fill(t.minutesEach, { minutes: card.durationMinutes }) : null,
    ].filter(Boolean).join(' · ');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(...MUTED);
    pdf.text(entitlement, left, y);
    y += 8;
  } else {
    pdf.setFont('times', 'normal');
    pdf.setFontSize(30);
    pdf.setTextColor(...INK);
    pdf.text(formatMoney(card), left, y + 4);
    y += 13;
  }

  if (card.note) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...ACCENT);
    const noteLines = pdf.splitTextToSize(pdfSafe(card.note), textWidth);
    pdf.text(noteLines, left, y);
    y += noteLines.length * 4 + 3;
  }

  try {
    const qr = await QRCode.toDataURL(card.code, {
      width: 240,
      margin: 0,
      errorCorrectionLevel: 'M',
      color: { dark: '#3A332B', light: '#FFFFFF' },
    });
    pdf.addImage(qr, 'PNG', left, y, 28, 28);
  } catch (error) {
    console.error('Error generating QR code:', error);
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...MUTED);
  pdf.text(t.code.toUpperCase(), left + 33, y + 8, { charSpace: 0.8 });
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(10.5);
  pdf.setTextColor(...INK);
  pdf.text(pdf.splitTextToSize(card.code, textWidth - 33), left + 33, y + 15);
  if (card.expiresAt) {
    const locale = card.language === 'de' ? 'de-DE' : 'en-US';
    const date = new Date(card.expiresAt).toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...MUTED);
    pdf.text(fill(t.validUntil, { date }), left + 33, y + 23);
  }
  y += 36;

  if (card.termsAndConditions) {
    pdf.setDrawColor(...RULE);
    pdf.line(left, y, pageWidth - 12, y);
    y += 5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    pdf.text(t.terms, left, y);
    y += 3.5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.5);
    const lines = pdf.splitTextToSize(pdfSafe(card.termsAndConditions), textWidth);
    const maxLines = Math.max(0, Math.floor((pageHeight - y - 8) / 2.8));
    pdf.text(lines.slice(0, maxLines), left, y, { lineHeightFactor: 1.25 });
  }
}

/** One A5 landscape page per voucher. */
export async function generateGiftCardsPDF(cards: GiftCardData[]): Promise<Blob> {
  if (cards.length === 0) throw new Error('No gift cards to print');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });
  const designs = new Map<string, Awaited<ReturnType<typeof loadImage>>>();

  for (const [index, card] of cards.entries()) {
    if (index > 0) pdf.addPage('a5', 'landscape');
    if (card.designUrl && !designs.has(card.designUrl)) {
      designs.set(card.designUrl, await loadImage(card.designUrl));
    }
    await drawCard(pdf, card, card.designUrl ? designs.get(card.designUrl) ?? null : null);
  }
  return pdf.output('blob');
}

export async function generateGiftCardPDF(giftCard: GiftCardData): Promise<Blob> {
  return generateGiftCardsPDF([giftCard]);
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadGiftCardPDF(giftCard: GiftCardData): Promise<void> {
  const blob = await generateGiftCardPDF(giftCard);
  saveBlob(blob, `${giftCard.cardType === 'service_pass' ? 'ServicePass' : 'GiftCard'}-${giftCard.code}.pdf`);
}

export async function downloadGiftCardsPDF(cards: GiftCardData[], fileName: string): Promise<void> {
  saveBlob(await generateGiftCardsPDF(cards), fileName);
}

export async function getGiftCardPDFBase64(giftCard: GiftCardData): Promise<string> {
  const blob = await generateGiftCardPDF(giftCard);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
