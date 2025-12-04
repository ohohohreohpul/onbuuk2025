import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

interface GiftCardData {
  code: string;
  amount: number;
  designUrl: string | null;
  termsAndConditions: string | null;
  businessName: string;
  expiresAt: string | null;
  currencySymbol?: string;
}

export async function generateGiftCardPDF(giftCard: GiftCardData): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a5',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const halfWidth = pageWidth / 2;

  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');

  if (giftCard.designUrl) {
    try {
      pdf.addImage(
        giftCard.designUrl,
        'JPEG',
        5,
        5,
        halfWidth - 10,
        pageHeight - 10,
        undefined,
        'FAST'
      );
    } catch (error) {
      console.error('Error adding design image:', error);
      pdf.setFillColor(240, 240, 240);
      pdf.rect(5, 5, halfWidth - 10, pageHeight - 10, 'F');

      pdf.setFontSize(12);
      pdf.setTextColor(100, 100, 100);
      pdf.text('Gift Card Design', halfWidth / 2, pageHeight / 2, { align: 'center' });
    }
  } else {
    pdf.setFillColor(240, 240, 240);
    pdf.rect(5, 5, halfWidth - 10, pageHeight - 10, 'F');

    pdf.setFontSize(20);
    pdf.setTextColor(60, 60, 60);
    pdf.text(giftCard.businessName, halfWidth / 2, pageHeight / 2 - 10, { align: 'center' });
    pdf.setFontSize(16);
    pdf.text('Gift Card', halfWidth / 2, pageHeight / 2 + 5, { align: 'center' });
  }

  pdf.setDrawColor(200, 200, 200);
  pdf.line(halfWidth, 10, halfWidth, pageHeight - 10);

  let yPosition = 15;

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(40, 40, 40);
  pdf.text('Gift Card', halfWidth + 10, yPosition);
  yPosition += 10;

  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 128, 0);
  const symbol = giftCard.currencySymbol || '$';
  pdf.text(`${symbol}${giftCard.amount.toFixed(2)}`, halfWidth + 10, yPosition);
  yPosition += 12;

  try {
    const qrCodeDataUrl = await QRCode.toDataURL(giftCard.code, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: 'H',
    });

    const qrSize = 35;
    pdf.addImage(qrCodeDataUrl, 'PNG', halfWidth + 10, yPosition, qrSize, qrSize);
    yPosition += qrSize + 5;
  } catch (error) {
    console.error('Error generating QR code:', error);
    yPosition += 5;
  }

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(60, 60, 60);
  pdf.text('Gift Card Code:', halfWidth + 10, yPosition);
  yPosition += 5;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(40, 40, 40);

  const codeLines = pdf.splitTextToSize(giftCard.code, halfWidth - 20);
  pdf.text(codeLines, halfWidth + 10, yPosition);
  yPosition += codeLines.length * 5 + 5;

  if (giftCard.expiresAt) {
    pdf.setFontSize(9);
    pdf.setTextColor(180, 0, 0);
    const expiryDate = new Date(giftCard.expiresAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    pdf.text(`Expires: ${expiryDate}`, halfWidth + 10, yPosition);
    yPosition += 7;
  }

  if (giftCard.termsAndConditions) {
    yPosition += 3;
    pdf.setDrawColor(220, 220, 220);
    pdf.line(halfWidth + 10, yPosition, pageWidth - 10, yPosition);
    yPosition += 5;

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(60, 60, 60);
    pdf.text('Terms & Conditions:', halfWidth + 10, yPosition);
    yPosition += 4;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(80, 80, 80);

    const terms = giftCard.termsAndConditions;
    const termsLines = pdf.splitTextToSize(terms, halfWidth - 20);

    const remainingSpace = pageHeight - yPosition - 10;
    const lineHeight = 3;
    const maxLines = Math.floor(remainingSpace / lineHeight);

    const displayedLines = termsLines.slice(0, maxLines);
    pdf.text(displayedLines, halfWidth + 10, yPosition);
  }

  return pdf.output('blob');
}

export async function downloadGiftCardPDF(giftCard: GiftCardData): Promise<void> {
  const blob = await generateGiftCardPDF(giftCard);
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `GiftCard-${giftCard.code}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
