import { jsPDF } from 'jspdf';
import { invoiceText, type Invoice } from './invoiceText';

const MARGIN = 20;
const PAGE_WIDTH = 210;
const RIGHT = PAGE_WIDTH - MARGIN;
const LINE = 5.5;

/** A4 invoice as PDF blob (standard Helvetica covers ä, ö, ü, ß and €). */
export function invoicePdf(invoice: Invoice): Blob {
  const text = invoiceText(invoice);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = MARGIN;

  pdf.setFont('helvetica', 'bold').setFontSize(13);
  text.seller.forEach((line, index) => {
    pdf.text(line, RIGHT, y + index * LINE, { align: 'right' });
    if (index === 0) pdf.setFont('helvetica', 'normal').setFontSize(10);
  });
  if (text.sellerTax) pdf.text(text.sellerTax, RIGHT, y + text.seller.length * LINE, { align: 'right' });

  y = 60;
  pdf.setFontSize(10);
  text.customer.forEach((line, index) => pdf.text(line, MARGIN, y + index * LINE));

  y = 90;
  pdf.setFont('helvetica', 'bold').setFontSize(16).text(text.title, MARGIN, y);
  pdf.setFont('helvetica', 'normal').setFontSize(10);
  text.meta.forEach((line, index) => pdf.text(line, MARGIN, y + 8 + index * LINE));

  y += 8 + text.meta.length * LINE + 8;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Leistung', MARGIN, y);
  pdf.text('Menge', 130, y, { align: 'right' });
  pdf.text('Einzelpreis', 160, y, { align: 'right' });
  pdf.text('Gesamt', RIGHT, y, { align: 'right' });
  pdf.setDrawColor(200).line(MARGIN, y + 2, RIGHT, y + 2);
  pdf.setFont('helvetica', 'normal');
  y += 8;

  for (const line of text.lines) {
    const wrapped = pdf.splitTextToSize(line.description, 95) as string[];
    pdf.text(wrapped, MARGIN, y);
    pdf.text(line.quantity, 130, y, { align: 'right' });
    pdf.text(line.unit, 160, y, { align: 'right' });
    pdf.text(line.total, RIGHT, y, { align: 'right' });
    y += wrapped.length * LINE + 1;
  }

  pdf.line(MARGIN, y, RIGHT, y);
  y += 7;
  text.totals.forEach(([label, value], index) => {
    const isLast = index === text.totals.length - 1;
    pdf.setFont('helvetica', isLast ? 'bold' : 'normal');
    pdf.text(label, 160, y, { align: 'right' });
    pdf.text(value, RIGHT, y, { align: 'right' });
    y += LINE + (isLast ? 2 : 0);
  });

  pdf.setFont('helvetica', 'normal');
  y += 6;
  text.notes.forEach((note) => {
    pdf.text(note, MARGIN, y);
    y += LINE;
  });

  if (text.footer) {
    pdf.setFontSize(8).setTextColor(110);
    pdf.text(pdf.splitTextToSize(text.footer, PAGE_WIDTH - 2 * MARGIN) as string[], MARGIN, 280);
  }
  return pdf.output('blob');
}
