// Gift Card PDF Generator for Deno Edge Functions
// Uses PDFKit alternative for Deno

interface GiftCardPDFData {
  code: string;
  amount: number;
  currencySymbol: string;
  businessName: string;
  expiresAt: string | null;
  recipientEmail: string | null;
  senderName: string | null;
  message: string | null;
}

// Generate a simple HTML-based gift card that can be converted to PDF or sent as rich email
export function generateGiftCardHTML(data: GiftCardPDFData): string {
  const expiryText = data.expiresAt 
    ? `Expires: ${new Date(data.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`
    : '';

  const messageSection = data.message 
    ? `<div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; font-style: italic;">"${data.message}"</p>
        ${data.senderName ? `<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">- ${data.senderName}</p>` : ''}
      </div>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .gift-card { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .header .business { font-size: 14px; opacity: 0.9; margin-top: 10px; }
    .content { padding: 40px; }
    .amount { font-size: 48px; font-weight: bold; color: #333; text-align: center; margin: 20px 0; }
    .code-box { background: #f8f9fa; border: 2px dashed #ddd; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
    .code-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
    .code { font-size: 24px; font-weight: bold; color: #333; letter-spacing: 3px; margin-top: 10px; font-family: monospace; }
    .expiry { text-align: center; color: #dc3545; font-size: 14px; margin-top: 20px; }
    .instructions { background: #e8f5e9; border-radius: 8px; padding: 20px; margin-top: 30px; }
    .instructions h3 { margin: 0 0 15px 0; color: #2e7d32; font-size: 16px; }
    .instructions ol { margin: 0; padding-left: 20px; color: #555; }
    .instructions li { margin: 8px 0; }
    .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="gift-card">
    <div class="header">
      <h1>🎁 Gift Card</h1>
      <div class="business">${data.businessName}</div>
    </div>
    <div class="content">
      <div class="amount">${data.currencySymbol}${data.amount.toFixed(2)}</div>
      
      ${messageSection}
      
      <div class="code-box">
        <div class="code-label">Your Gift Card Code</div>
        <div class="code">${data.code}</div>
      </div>
      
      ${expiryText ? `<div class="expiry">${expiryText}</div>` : ''}
      
      <div class="instructions">
        <h3>How to Redeem</h3>
        <ol>
          <li>Visit ${data.businessName}'s booking page</li>
          <li>Select your desired service</li>
          <li>Enter your gift card code at checkout</li>
          <li>Enjoy your service!</li>
        </ol>
      </div>
    </div>
    <div class="footer">
      This gift card is redeemable only at ${data.businessName}.<br>
      Please keep this code safe - it can only be used once.
    </div>
  </div>
</body>
</html>
  `.trim();
}

// Generate a base64 encoded simple PDF-like document
// For actual PDF generation in Deno, we'd need a proper PDF library
// For now, we'll enhance the HTML email to look like a printable gift card
export function generateGiftCardEmailHTML(data: GiftCardPDFData): string {
  return generateGiftCardHTML(data);
}
