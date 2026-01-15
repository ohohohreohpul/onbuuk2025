import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GiftCardPDFRequest {
  code: string;
  amount: string;
  currencySymbol?: string;
  businessName: string;
  businessId: string;
  expiresAt?: string | null;
  recipientEmail?: string | null;
  senderName?: string | null;
  message?: string | null;
}

async function generateGiftCardPDF(data: GiftCardPDFRequest): Promise<string> {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Add a page with gift card dimensions (landscape, credit card-ish size)
  const page = pdfDoc.addPage([500, 280]);
  const { width, height } = page.getSize();
  
  // Embed fonts
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const courier = await pdfDoc.embedFont(StandardFonts.Courier);
  
  // Colors
  const primaryColor = rgb(0.4, 0.49, 0.92); // #667eea
  const darkGray = rgb(0.2, 0.2, 0.2);
  const mediumGray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.95, 0.95, 0.95);
  const white = rgb(1, 1, 1);
  const redColor = rgb(0.86, 0.21, 0.27);
  
  // Draw background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: height,
    color: primaryColor,
  });
  
  // Draw white card area with padding
  const cardPadding = 20;
  page.drawRectangle({
    x: cardPadding,
    y: cardPadding,
    width: width - (cardPadding * 2),
    height: height - (cardPadding * 2),
    color: white,
  });
  
  // Header - "GIFT CARD"
  const headerText = "GIFT CARD";
  const headerFontSize = 28;
  const headerWidth = helveticaBold.widthOfTextAtSize(headerText, headerFontSize);
  page.drawText(headerText, {
    x: (width - headerWidth) / 2,
    y: height - 60,
    size: headerFontSize,
    font: helveticaBold,
    color: primaryColor,
  });
  
  // Business name
  const businessFontSize = 12;
  const businessWidth = helvetica.widthOfTextAtSize(data.businessName, businessFontSize);
  page.drawText(data.businessName, {
    x: (width - businessWidth) / 2,
    y: height - 80,
    size: businessFontSize,
    font: helvetica,
    color: mediumGray,
  });
  
  // Amount - large and centered
  const amountFontSize = 42;
  const amountWidth = helveticaBold.widthOfTextAtSize(data.amount, amountFontSize);
  page.drawText(data.amount, {
    x: (width - amountWidth) / 2,
    y: height - 135,
    size: amountFontSize,
    font: helveticaBold,
    color: darkGray,
  });
  
  // Code box background
  const codeBoxWidth = 280;
  const codeBoxHeight = 50;
  const codeBoxX = (width - codeBoxWidth) / 2;
  const codeBoxY = 55;
  
  page.drawRectangle({
    x: codeBoxX,
    y: codeBoxY,
    width: codeBoxWidth,
    height: codeBoxHeight,
    color: lightGray,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
  });
  
  // Code label
  const codeLabelText = "GIFT CARD CODE";
  const codeLabelFontSize = 9;
  const codeLabelWidth = helvetica.widthOfTextAtSize(codeLabelText, codeLabelFontSize);
  page.drawText(codeLabelText, {
    x: (width - codeLabelWidth) / 2,
    y: codeBoxY + codeBoxHeight - 15,
    size: codeLabelFontSize,
    font: helvetica,
    color: mediumGray,
  });
  
  // Gift card code
  const codeFontSize = 20;
  const codeWidth = courier.widthOfTextAtSize(data.code, codeFontSize);
  page.drawText(data.code, {
    x: (width - codeWidth) / 2,
    y: codeBoxY + 12,
    size: codeFontSize,
    font: courier,
    color: darkGray,
  });
  
  // Expiry date if provided
  if (data.expiresAt) {
    const expiryDate = new Date(data.expiresAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const expiryText = `Expires: ${expiryDate}`;
    const expiryFontSize = 10;
    const expiryWidth = helvetica.widthOfTextAtSize(expiryText, expiryFontSize);
    page.drawText(expiryText, {
      x: (width - expiryWidth) / 2,
      y: 38,
      size: expiryFontSize,
      font: helvetica,
      color: redColor,
    });
  }
  
  // Footer
  const footerText = `Redeemable at ${data.businessName}`;
  const footerFontSize = 8;
  const footerWidth = helvetica.widthOfTextAtSize(footerText, footerFontSize);
  page.drawText(footerText, {
    x: (width - footerWidth) / 2,
    y: 25,
    size: footerFontSize,
    font: helvetica,
    color: mediumGray,
  });
  
  // Serialize the PDF to bytes
  const pdfBytes = await pdfDoc.save();
  
  // Convert to base64
  const base64 = btoa(String.fromCharCode(...pdfBytes));
  
  return base64;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const data: GiftCardPDFRequest = await req.json();

    console.log("Generating PDF for gift card:", data.code);

    if (!data.code || !data.amount || !data.businessName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: code, amount, businessName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate the PDF
    const pdfBase64 = await generateGiftCardPDF(data);

    console.log("PDF generated successfully, size:", pdfBase64.length);

    return new Response(
      JSON.stringify({ 
        success: true, 
        pdf: pdfBase64,
        filename: `GiftCard-${data.code}.pdf`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error generating gift card PDF:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate PDF" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
