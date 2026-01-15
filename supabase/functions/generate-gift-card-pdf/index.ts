import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@2.5.1";

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

function generateGiftCardPDF(data: GiftCardPDFRequest, designUrl?: string): string {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [180, 100],
  });

  const width = 180;
  const height = 100;

  // Background gradient simulation with rectangles
  doc.setFillColor(102, 126, 234); // #667eea
  doc.rect(0, 0, width, height, "F");
  
  // Add a slightly lighter overlay for gradient effect
  doc.setFillColor(118, 75, 162, 0.3); // #764ba2 with opacity
  doc.rect(width * 0.3, 0, width * 0.7, height, "F");

  // White card area
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(10, 10, width - 20, height - 20, 5, 5, "F");

  // Gift icon / Header
  doc.setFontSize(24);
  doc.setTextColor(102, 126, 234);
  doc.text("🎁 GIFT CARD", width / 2, 25, { align: "center" });

  // Business name
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(data.businessName, width / 2, 33, { align: "center" });

  // Amount
  doc.setFontSize(36);
  doc.setTextColor(51, 51, 51);
  const amountText = data.amount;
  doc.text(amountText, width / 2, 52, { align: "center" });

  // Code box background
  doc.setFillColor(248, 249, 250);
  doc.setDrawColor(200, 200, 200);
  doc.setLineDashPattern([2, 2], 0);
  doc.roundedRect(30, 58, width - 60, 18, 3, 3, "FD");
  doc.setLineDashPattern([], 0);

  // Code label
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("GIFT CARD CODE", width / 2, 64, { align: "center" });

  // Code
  doc.setFontSize(16);
  doc.setTextColor(51, 51, 51);
  doc.setFont("courier", "bold");
  doc.text(data.code, width / 2, 72, { align: "center" });
  doc.setFont("helvetica", "normal");

  // Expiry date if provided
  if (data.expiresAt) {
    const expiryDate = new Date(data.expiresAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.setFontSize(8);
    doc.setTextColor(220, 53, 69); // Red for expiry
    doc.text(`Expires: ${expiryDate}`, width / 2, 82, { align: "center" });
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Redeemable at ${data.businessName}`, width / 2, 90, { align: "center" });

  // Return base64 encoded PDF
  return doc.output("datauristring").split(",")[1];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const data: GiftCardPDFRequest = await req.json();

    if (!data.code || !data.amount || !data.businessName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: code, amount, businessName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate the PDF
    const pdfBase64 = generateGiftCardPDF(data);

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
