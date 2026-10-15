import { useState, useEffect } from 'react';
import { X, Trash2, Download, Mail, Edit2, Save, Banknote, CreditCard, Loader2 } from 'lucide-react';
import { markOrderPaid, type ShopPaymentMethod } from './giftCardOrders/giftCardOrdersApi';
import { ADMIN_INPUT, ADMIN_MODAL, ADMIN_MODAL_BACKDROP, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_STATUS_PILL, ADMIN_TERTIARY_BUTTON } from './adminUi';
import { supabase } from '../../lib/supabase';
import { useCurrency } from '../../lib/currencyContext';
import { useTenant } from '../../lib/tenantContext';
import { downloadGiftCardPDF, getGiftCardPDFBase64 } from '../../lib/giftCardPdfGenerator';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, Translations } from '../../lib/bookingLanguage';

type DetailText = {
  emailsSaved: string; emailsSaveFailed: string; addBuyerEmail: string; addRecipientEmail: string; addAnyEmail: string;
  buyerError: string; recipientError: string; someEmailsFailed: string; sentToBuyer: string; sentToRecipient: string;
  sentToBoth: string; sendFailed: string; tryAgain: string; invalidAmount: string; exceedsBalance: string;
  redeemFailed: string; confirmDelete: string; deleted: string; deleteFailed: string; downloadFailed: string;
  passDetails: string; cardDetails: string; servicePass: string; valueCard: string; visitLeft: string; visitsLeft: string;
  passOriginally: string; originalValue: string; code: string; purchased: string; expires: string; expiredSuffix: string;
  contactInfo: string; edit: string; saving: string; save: string; buyerName: string; buyerNamePlaceholder: string;
  buyerEmail: string; recipientEmail: string; recipientHint: string; cancel: string; buyer: string; noName: string;
  noEmail: string; recipient: string; sending: string; send: string; sendBoth: string; downloadPdf: string;
  redeemHeading: string; amount: string; descriptionOptional: string; descriptionPlaceholder: string; processing: string;
  redeemAmount: string; visitRedemption: string; visitRedemptionHint: string; history: string; loading: string;
  noTransactions: string; visitOne: string; visitMany: string; deleting: string; deleteCard: string; close: string;
  statusActive: string; statusFullyRedeemed: string; statusExpired: string; statusCancelled: string; statusPendingPayment: string;
  txnPurchase: string; txnRedemption: string; txnRefund: string;
  notPaid: string; notPaidHint: string; paidWith: string; cash: string; card: string; payFailed: string; validUntil: string; of: string;
};

const TEXT: Translations<DetailText> = {
  en: {
    emailsSaved: 'Email information saved successfully!', emailsSaveFailed: 'Failed to save email information',
    addBuyerEmail: 'Please add a buyer email first', addRecipientEmail: 'Please add a recipient email first',
    addAnyEmail: 'Please add at least one email address', buyerError: 'Buyer: {error}', recipientError: 'Recipient: {error}',
    someEmailsFailed: 'Some emails failed to send:\n{errors}\n\nPlease check your email settings.',
    sentToBuyer: 'Email with PDF attachment sent successfully to buyer!',
    sentToRecipient: 'Email with PDF attachment sent successfully to recipient!',
    sentToBoth: 'Email with PDF attachment sent successfully to buyer and recipient!',
    sendFailed: 'Failed to send email: {error}', tryAgain: 'Please try again.', invalidAmount: 'Please enter a valid amount',
    exceedsBalance: 'Redemption amount exceeds current balance', redeemFailed: 'Failed to redeem gift card',
    confirmDelete: 'Are you sure you want to delete this gift card? This action cannot be undone.',
    deleted: 'Gift card deleted successfully', deleteFailed: 'Failed to delete gift card', downloadFailed: 'Failed to download gift card PDF',
    passDetails: 'Service Pass Details', cardDetails: 'Gift Card Details', servicePass: 'Service Pass', valueCard: 'Value Card',
    visitLeft: '1 visit left', visitsLeft: '{count} visits left', passOriginally: '{name} · {count} originally',
    originalValue: 'Original value: {amount}', code: 'Code:', purchased: 'Purchased:', expires: 'Expires:', expiredSuffix: ' (Expired)',
    contactInfo: 'Contact Information', edit: 'Edit', saving: 'Saving...', save: 'Save', buyerName: 'Buyer Name',
    buyerNamePlaceholder: "Enter buyer's name", buyerEmail: 'Buyer Email', recipientEmail: 'Recipient Email',
    recipientHint: 'The person who will receive/use this gift card', cancel: 'Cancel', buyer: 'Buyer', noName: 'No name',
    noEmail: 'No email - click Edit to add', recipient: 'Recipient', sending: 'Sending...', send: 'Send', sendBoth: 'Send to Both',
    downloadPdf: 'Download PDF', redeemHeading: 'Redeem Gift Card', amount: 'Amount ({symbol})',
    descriptionOptional: 'Description (optional)', descriptionPlaceholder: 'e.g., Booking #123', processing: 'Processing...',
    redeemAmount: 'Redeem Amount', visitRedemption: 'Visit redemption',
    visitRedemptionHint: 'This pass is visit-based, so it is redeemed through checkout when the customer books the matching service. It is never deducted as a cash amount.',
    history: 'Transaction History', loading: 'Loading...', noTransactions: 'No transactions yet',
    visitOne: '1 visit', visitMany: '{count} visits', deleting: 'Deleting...', deleteCard: 'Delete gift card', close: 'Close',
    notPaid: 'Not paid yet', notPaidHint: 'The voucher becomes valid once it is paid.', paidWith: 'Paid with:', cash: 'Cash', card: 'Card', payFailed: 'Could not save the payment.', validUntil: 'Valid until', of: 'of {amount}',
    statusActive: 'Active', statusFullyRedeemed: 'Fully redeemed', statusExpired: 'Expired', statusCancelled: 'Cancelled',
    statusPendingPayment: 'Awaiting payment', txnPurchase: 'Purchase', txnRedemption: 'Redemption', txnRefund: 'Refund',
  },
  de: {
    emailsSaved: 'E-Mail-Angaben gespeichert.', emailsSaveFailed: 'E-Mail-Angaben konnten nicht gespeichert werden',
    addBuyerEmail: 'Bitte zuerst eine E-Mail-Adresse der Käufer:in hinzufügen',
    addRecipientEmail: 'Bitte zuerst eine E-Mail-Adresse der Empfänger:in hinzufügen',
    addAnyEmail: 'Bitte mindestens eine E-Mail-Adresse hinzufügen', buyerError: 'Käufer:in: {error}', recipientError: 'Empfänger:in: {error}',
    someEmailsFailed: 'Einige E-Mails konnten nicht gesendet werden:\n{errors}\n\nBitte prüfen Sie Ihre E-Mail-Einstellungen.',
    sentToBuyer: 'E-Mail mit PDF-Anhang an die Käufer:in gesendet.',
    sentToRecipient: 'E-Mail mit PDF-Anhang an die Empfänger:in gesendet.',
    sentToBoth: 'E-Mail mit PDF-Anhang an Käufer:in und Empfänger:in gesendet.',
    sendFailed: 'E-Mail konnte nicht gesendet werden: {error}', tryAgain: 'Bitte erneut versuchen.',
    invalidAmount: 'Bitte einen gültigen Betrag eingeben', exceedsBalance: 'Der Betrag übersteigt das aktuelle Guthaben',
    redeemFailed: 'Gutschein konnte nicht eingelöst werden',
    confirmDelete: 'Diesen Gutschein wirklich löschen? Dies kann nicht rückgängig gemacht werden.',
    deleted: 'Gutschein gelöscht', deleteFailed: 'Gutschein konnte nicht gelöscht werden', downloadFailed: 'Gutschein-PDF konnte nicht heruntergeladen werden',
    passDetails: 'Details zum Behandlungsgutschein', cardDetails: 'Gutscheindetails', servicePass: 'Behandlungsgutschein', valueCard: 'Wertgutschein',
    visitLeft: 'Noch 1 Besuch', visitsLeft: 'Noch {count} Besuche', passOriginally: '{name} · ursprünglich {count}',
    originalValue: 'Ursprünglicher Wert: {amount}', code: 'Code:', purchased: 'Gekauft:', expires: 'Gültig bis:', expiredSuffix: ' (abgelaufen)',
    contactInfo: 'Kontaktdaten', edit: 'Bearbeiten', saving: 'Speichern...', save: 'Speichern', buyerName: 'Name Käufer:in',
    buyerNamePlaceholder: 'Name der Käufer:in eingeben', buyerEmail: 'E-Mail Käufer:in', recipientEmail: 'E-Mail Empfänger:in',
    recipientHint: 'Die Person, die diesen Gutschein erhält bzw. einlöst', cancel: 'Abbrechen', buyer: 'Käufer:in', noName: 'Kein Name',
    noEmail: 'Keine E-Mail – zum Hinzufügen auf Bearbeiten klicken', recipient: 'Empfänger:in', sending: 'Wird gesendet...',
    send: 'Senden', sendBoth: 'An beide senden', downloadPdf: 'PDF herunterladen', redeemHeading: 'Gutschein einlösen',
    amount: 'Betrag ({symbol})', descriptionOptional: 'Beschreibung (optional)', descriptionPlaceholder: 'z. B. Buchung #123',
    processing: 'Wird verarbeitet...', redeemAmount: 'Betrag einlösen', visitRedemption: 'Einlösung pro Besuch',
    visitRedemptionHint: 'Dieser Gutschein gilt pro Besuch und wird an der Kasse eingelöst, wenn die Kund:in die passende Leistung bucht. Er wird nie als Geldbetrag abgezogen.',
    history: 'Transaktionsverlauf', loading: 'Wird geladen...', noTransactions: 'Noch keine Transaktionen',
    visitOne: '1 Besuch', visitMany: '{count} Besuche', deleting: 'Wird gelöscht...', deleteCard: 'Gutschein löschen', close: 'Schließen',
    notPaid: 'Noch nicht bezahlt', notPaidHint: 'Der Gutschein ist nach der Zahlung gültig.', paidWith: 'Bezahlt mit:', cash: 'Bar', card: 'Karte', payFailed: 'Zahlung konnte nicht gespeichert werden.', validUntil: 'Gültig bis', of: 'von {amount}',
    statusActive: 'Aktiv', statusFullyRedeemed: 'Vollständig eingelöst', statusExpired: 'Abgelaufen', statusCancelled: 'Storniert',
    statusPendingPayment: 'Zahlung offen', txnPurchase: 'Kauf', txnRedemption: 'Einlösung', txnRefund: 'Erstattung',
  },
  th: {
    emailsSaved: 'บันทึกข้อมูลอีเมลแล้ว', emailsSaveFailed: 'บันทึกข้อมูลอีเมลไม่สำเร็จ',
    addBuyerEmail: 'กรุณาเพิ่มอีเมลผู้ซื้อก่อน', addRecipientEmail: 'กรุณาเพิ่มอีเมลผู้รับก่อน',
    addAnyEmail: 'กรุณาเพิ่มอีเมลอย่างน้อยหนึ่งรายการ', buyerError: 'ผู้ซื้อ: {error}', recipientError: 'ผู้รับ: {error}',
    someEmailsFailed: 'ส่งอีเมลบางฉบับไม่สำเร็จ:\n{errors}\n\nกรุณาตรวจสอบการตั้งค่าอีเมล',
    sentToBuyer: 'ส่งอีเมลพร้อมไฟล์ PDF ถึงผู้ซื้อแล้ว', sentToRecipient: 'ส่งอีเมลพร้อมไฟล์ PDF ถึงผู้รับแล้ว',
    sentToBoth: 'ส่งอีเมลพร้อมไฟล์ PDF ถึงผู้ซื้อและผู้รับแล้ว',
    sendFailed: 'ส่งอีเมลไม่สำเร็จ: {error}', tryAgain: 'กรุณาลองอีกครั้ง', invalidAmount: 'กรุณากรอกจำนวนเงินที่ถูกต้อง',
    exceedsBalance: 'จำนวนเงินเกินยอดคงเหลือ', redeemFailed: 'ใช้บัตรของขวัญไม่สำเร็จ',
    confirmDelete: 'ต้องการลบบัตรของขวัญนี้ใช่ไหม? การลบนี้ย้อนกลับไม่ได้',
    deleted: 'ลบบัตรของขวัญแล้ว', deleteFailed: 'ลบบัตรของขวัญไม่สำเร็จ', downloadFailed: 'ดาวน์โหลด PDF บัตรของขวัญไม่สำเร็จ',
    passDetails: 'รายละเอียดบัตรบริการ', cardDetails: 'รายละเอียดบัตรของขวัญ', servicePass: 'บัตรบริการ', valueCard: 'บัตรมูลค่า',
    visitLeft: 'เหลือ 1 ครั้ง', visitsLeft: 'เหลือ {count} ครั้ง', passOriginally: '{name} · เดิม {count} ครั้ง',
    originalValue: 'มูลค่าเดิม: {amount}', code: 'รหัส:', purchased: 'วันที่ซื้อ:', expires: 'หมดอายุ:', expiredSuffix: ' (หมดอายุแล้ว)',
    contactInfo: 'ข้อมูลติดต่อ', edit: 'แก้ไข', saving: 'กำลังบันทึก...', save: 'บันทึก', buyerName: 'ชื่อผู้ซื้อ',
    buyerNamePlaceholder: 'กรอกชื่อผู้ซื้อ', buyerEmail: 'อีเมลผู้ซื้อ', recipientEmail: 'อีเมลผู้รับ',
    recipientHint: 'ผู้ที่จะได้รับหรือใช้บัตรของขวัญนี้', cancel: 'ยกเลิก', buyer: 'ผู้ซื้อ', noName: 'ไม่มีชื่อ',
    noEmail: 'ไม่มีอีเมล - กดแก้ไขเพื่อเพิ่ม', recipient: 'ผู้รับ', sending: 'กำลังส่ง...', send: 'ส่ง', sendBoth: 'ส่งถึงทั้งสองคน',
    downloadPdf: 'ดาวน์โหลด PDF', redeemHeading: 'ใช้บัตรของขวัญ', amount: 'จำนวนเงิน ({symbol})',
    descriptionOptional: 'รายละเอียด (ไม่บังคับ)', descriptionPlaceholder: 'เช่น การจอง #123', processing: 'กำลังดำเนินการ...',
    redeemAmount: 'ใช้ยอดเงิน', visitRedemption: 'การใช้สิทธิ์ตามครั้ง',
    visitRedemptionHint: 'บัตรนี้นับตามจำนวนครั้ง จะถูกใช้ตอนชำระเงินเมื่อลูกค้าจองบริการที่ตรงกัน และไม่ถูกหักเป็นยอดเงิน',
    history: 'ประวัติรายการ', loading: 'กำลังโหลด...', noTransactions: 'ยังไม่มีรายการ',
    visitOne: '1 ครั้ง', visitMany: '{count} ครั้ง', deleting: 'กำลังลบ...', deleteCard: 'ลบบัตรของขวัญ', close: 'ปิด',
    notPaid: 'ยังไม่ชำระ', notPaidHint: 'บัตรจะใช้ได้หลังชำระเงิน', paidWith: 'ชำระด้วย:', cash: 'เงินสด', card: 'บัตร', payFailed: 'บันทึกการชำระเงินไม่สำเร็จ', validUntil: 'ใช้ได้ถึง', of: 'จาก {amount}',
    statusActive: 'ใช้งานได้', statusFullyRedeemed: 'ใช้ครบแล้ว', statusExpired: 'หมดอายุ', statusCancelled: 'ยกเลิกแล้ว',
    statusPendingPayment: 'รอชำระเงิน', txnPurchase: 'ซื้อ', txnRedemption: 'ใช้บัตร', txnRefund: 'คืนเงิน',
  },
};

const STATUS_KEYS: Record<string, keyof DetailText> = {
  active: 'statusActive',
  fully_redeemed: 'statusFullyRedeemed',
  redeemed: 'statusFullyRedeemed',
  expired: 'statusExpired',
  cancelled: 'statusCancelled',
  pending_payment: 'statusPendingPayment',
};

const TRANSACTION_KEYS: Record<string, keyof DetailText> = {
  purchase: 'txnPurchase',
  redemption: 'txnRedemption',
  refund: 'txnRefund',
};

interface GiftCard {
  id: string;
  code: string;
  original_value_cents: number;
  current_balance_cents: number;
  purchase_price_cents?: number;
  card_type?: 'value' | 'service_pass';
  service_pass_name?: string | null;
  original_visits?: number | null;
  remaining_visits?: number | null;
  status: string;
  order_id?: string | null;
  purchased_at: string;
  expires_at: string | null;
  purchased_for_email: string | null;
  purchased_by_email?: string | null;
  purchased_by_name?: string | null;
}

interface Transaction {
  id: string;
  amount_cents: number;
  transaction_type: string;
  description: string;
  created_at: string;
  created_by: string | null;
  visit_count?: number;
}

interface GiftCardDetailModalProps {
  giftCard: GiftCard;
  businessName: string;
  designUrl: string | null;
  termsAndConditions: string | null;
  onClose: () => void;
  onUpdate: () => void;
}

export function GiftCardDetailModal({
  giftCard,
  businessName,
  designUrl,
  termsAndConditions,
  onClose,
  onUpdate,
}: GiftCardDetailModalProps) {
  const { currency, currencySymbol, formatAmount } = useCurrency();
  const { businessId, language } = useTenant();
  const { t, locale } = useAdminText(TEXT);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeemDescription, setRedeemDescription] = useState('');
  const [deleting, setDeleting] = useState(false);
  
  // Email editing state
  const [isEditingEmails, setIsEditingEmails] = useState(false);
  const [buyerEmail, setBuyerEmail] = useState(giftCard.purchased_by_email || '');
  const [buyerName, setBuyerName] = useState(giftCard.purchased_by_name || '');
  const [recipientEmail, setRecipientEmail] = useState(giftCard.purchased_for_email || '');
  const [savingEmails, setSavingEmails] = useState(false);
  const [sendingEmail, setSendingEmail] = useState<'buyer' | 'recipient' | 'both' | null>(null);
  const isServicePass = giftCard.card_type === 'service_pass';
  // Sent to customers as an email template variable, so it stays independent of the admin language.
  const entitlementLabel = isServicePass
    ? `${giftCard.service_pass_name || 'Service pass'} · ${giftCard.original_visits || 0} ${(giftCard.original_visits || 0) === 1 ? 'visit' : 'visits'}`
    : formatAmount(giftCard.original_value_cents / 100);

  useEffect(() => {
    loadTransactions();
  }, [giftCard.id]);

  useEffect(() => {
    setBuyerEmail(giftCard.purchased_by_email || '');
    setBuyerName(giftCard.purchased_by_name || '');
    setRecipientEmail(giftCard.purchased_for_email || '');
  }, [giftCard]);

  const loadTransactions = async () => {
    const { data } = await supabase
      .from('gift_card_transactions')
      .select('*')
      .eq('gift_card_id', giftCard.id)
      .order('created_at', { ascending: false });

    if (data) {
      setTransactions(data);
    }
    setLoading(false);
  };

  const handleSaveEmails = async () => {
    setSavingEmails(true);
    try {
      const { error } = await supabase
        .from('gift_cards')
        .update({
          purchased_by_email: buyerEmail || null,
          purchased_by_name: buyerName || null,
          purchased_for_email: recipientEmail || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', giftCard.id);

      if (error) throw error;

      setIsEditingEmails(false);
      onUpdate();
      alert(t.emailsSaved);
    } catch (error) {
      console.error('Error saving emails:', error);
      alert(t.emailsSaveFailed);
    } finally {
      setSavingEmails(false);
    }
  };

  const handleSendEmail = async (target: 'buyer' | 'recipient' | 'both') => {
    if (target === 'buyer' && !buyerEmail) {
      alert(t.addBuyerEmail);
      return;
    }
    if (target === 'recipient' && !recipientEmail) {
      alert(t.addRecipientEmail);
      return;
    }
    if (target === 'both' && !buyerEmail && !recipientEmail) {
      alert(t.addAnyEmail);
      return;
    }

    setSendingEmail(target);
    try {
      const errors: string[] = [];

      // Generate PDF using the same client-side generator as "Download PDF" button
      let pdfAttachment: { filename: string; content: string; contentType: string } | null = null;
      try {
        const pdfBase64 = await getGiftCardPDFBase64({
          code: giftCard.code,
          amount: giftCard.original_value_cents / 100,
          cardType: giftCard.card_type || 'value',
          servicePassName: giftCard.service_pass_name,
          visits: giftCard.original_visits,
          designUrl: designUrl,
          termsAndConditions: termsAndConditions,
          businessName: businessName,
          expiresAt: giftCard.expires_at,
          currencySymbol: currencySymbol,
        currencyCode: currency,
        language: language === 'de' ? 'de' : 'en',
        });

        pdfAttachment = {
          filename: `GiftCard-${giftCard.code}.pdf`,
          content: pdfBase64,
          contentType: 'application/pdf',
        };
        console.log('PDF generated successfully');
      } catch (pdfErr) {
        console.warn('PDF generation failed, sending email without attachment:', pdfErr);
      }

      const emailPromises = [];

      // Send to buyer
      if ((target === 'buyer' || target === 'both') && buyerEmail) {
        emailPromises.push(
          supabase.functions.invoke('send-business-email', {
            body: {
              business_id: businessId,
              event_key: 'gift_card_purchased',
              recipient_email: buyerEmail,
              recipient_name: buyerName || buyerEmail.split('@')[0],
              variables: {
                customer_name: buyerName || 'Valued Customer',
                customer_email: buyerEmail,
                gift_card_code: giftCard.code,
                amount: entitlementLabel,
                recipient_email: recipientEmail || 'N/A',
                message: '',
                business_name: businessName,
              },
              attachments: pdfAttachment ? [pdfAttachment] : undefined,
            },
          }).then(({ data, error }) => {
            if (error) {
              console.error('Error sending to buyer:', error);
              errors.push(fillText(t.buyerError, { error: error.message }));
            } else if (data?.error) {
              console.error('Email service error (buyer):', data.error);
              errors.push(fillText(t.buyerError, { error: String(data.error) }));
            } else {
              console.log('Email sent to buyer successfully');
            }
            return { data, error };
          })
        );
      }

      // Send to recipient
      if ((target === 'recipient' || target === 'both') && recipientEmail) {
        emailPromises.push(
          supabase.functions.invoke('send-business-email', {
            body: {
              business_id: businessId,
              event_key: 'gift_card_received',
              recipient_email: recipientEmail,
              recipient_name: recipientEmail.split('@')[0],
              variables: {
                recipient_email: recipientEmail,
                gift_card_code: giftCard.code,
                amount: entitlementLabel,
                message: '',
                sender_name: buyerName || 'Someone special',
                business_name: businessName,
              },
              attachments: pdfAttachment ? [pdfAttachment] : undefined,
            },
          }).then(({ data, error }) => {
            if (error) {
              console.error('Error sending to recipient:', error);
              errors.push(fillText(t.recipientError, { error: error.message }));
            } else if (data?.error) {
              console.error('Email service error (recipient):', data.error);
              errors.push(fillText(t.recipientError, { error: String(data.error) }));
            } else {
              console.log('Email sent to recipient successfully');
            }
            return { data, error };
          })
        );
      }

      await Promise.all(emailPromises);
      
      if (errors.length > 0) {
        alert(fillText(t.someEmailsFailed, { errors: errors.join('\n') }));
      } else {
        const sentMessage = { buyer: t.sentToBuyer, recipient: t.sentToRecipient, both: t.sentToBoth }[target];
        alert(sentMessage);
      }
    } catch (error: any) {
      console.error('Error sending email:', error);
      alert(fillText(t.sendFailed, { error: error.message || t.tryAgain }));
    } finally {
      setSendingEmail(null);
    }
  };

  const handleRedeem = async () => {
    if (!redeemAmount || parseFloat(redeemAmount) <= 0) {
      alert(t.invalidAmount);
      return;
    }

    const amountCents = Math.round(parseFloat(redeemAmount) * 100);

    if (amountCents > giftCard.current_balance_cents) {
      alert(t.exceedsBalance);
      return;
    }

    setRedeeming(true);

    try {
      const newBalance = giftCard.current_balance_cents - amountCents;
      const newStatus = newBalance === 0 ? 'fully_redeemed' : 'active';

      await supabase.from('gift_card_transactions').insert({
        gift_card_id: giftCard.id,
        amount_cents: amountCents,
        transaction_type: 'redemption',
        description: redeemDescription || 'Manual redemption',
      });

      await supabase
        .from('gift_cards')
        .update({
          current_balance_cents: newBalance,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', giftCard.id);

      setRedeemAmount('');
      setRedeemDescription('');
      loadTransactions();
      onUpdate();
    } catch (error) {
      console.error('Error redeeming gift card:', error);
      alert(t.redeemFailed);
    } finally {
      setRedeeming(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t.confirmDelete)) {
      return;
    }

    setDeleting(true);

    try {
      const { error } = await supabase.from('gift_cards').delete().eq('id', giftCard.id);

      if (error) throw error;

      alert(t.deleted);
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error deleting gift card:', error);
      alert(t.deleteFailed);
    } finally {
      setDeleting(false);
    }
  };

  const [paying, setPaying] = useState(false);
  /** Vouchers ordered online and paid in the shop: one tap activates them and records the method. */
  const handlePay = async (method: ShopPaymentMethod) => {
    if (!giftCard.order_id) return;
    setPaying(true);
    try {
      await markOrderPaid(giftCard.order_id, method);
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Could not mark gift card order paid:', error);
      alert(t.payFailed);
      setPaying(false);
    }
  };

  const handleDownload = async () => {
    try {
      await downloadGiftCardPDF({
        code: giftCard.code,
        amount: giftCard.original_value_cents / 100,
        cardType: giftCard.card_type || 'value',
        servicePassName: giftCard.service_pass_name,
        visits: giftCard.original_visits,
        designUrl: designUrl,
        termsAndConditions: termsAndConditions,
        businessName: businessName,
        expiresAt: giftCard.expires_at,
        currencySymbol: currencySymbol,
        currencyCode: currency,
        language: language === 'de' ? 'de' : 'en',
      });
    } catch (error) {
      console.error('Error downloading gift card:', error);
      alert(t.downloadFailed);
    }
  };

  const isExpired = giftCard.expires_at && new Date(giftCard.expires_at) < new Date();
  const balancePercentage = isServicePass
    ? ((giftCard.remaining_visits || 0) / Math.max(1, giftCard.original_visits || 1)) * 100
    : (giftCard.current_balance_cents / Math.max(1, giftCard.original_value_cents)) * 100;

  const statusTone =
    giftCard.status === 'active' ? 'bg-emerald-50 text-emerald-700'
    : giftCard.status === 'pending_payment' ? 'bg-amber-50 text-amber-800'
    : giftCard.status === 'fully_redeemed' ? 'bg-stone-900/[0.05] text-stone-600'
    : 'bg-red-50 text-red-700';
  const formatDate = (value: string) => new Date(value).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  const sectionTitle = 'mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400';

  return (
    <div className={ADMIN_MODAL_BACKDROP} role="dialog" aria-modal="true" aria-labelledby="gift-card-title">
      <div className={`${ADMIN_MODAL} max-h-[90vh] max-w-2xl overflow-y-auto`}>
        <header className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <p className="text-sm text-stone-500">{isServicePass ? giftCard.service_pass_name || t.servicePass : t.valueCard}</p>
            <h2 id="gift-card-title" className="mt-0.5 font-mono text-2xl font-semibold tracking-wide text-[#1A1714]">{giftCard.code}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`${ADMIN_STATUS_PILL} ${statusTone}`}>
              {STATUS_KEYS[giftCard.status] ? t[STATUS_KEYS[giftCard.status]] : giftCard.status.replace('_', ' ')}
            </span>
            <button type="button" onClick={onClose} aria-label={t.close} title={t.close} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-900/[0.05] hover:text-stone-700">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="space-y-5 p-6">
          {giftCard.status === 'pending_payment' && (
            <section className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200/70">
              <p className="font-semibold text-amber-900">{t.notPaid}</p>
              <p className="mt-0.5 text-sm text-amber-800">{t.notPaidHint}</p>
              {giftCard.order_id && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-amber-900">{t.paidWith}</span>
                  <button type="button" onClick={() => handlePay('cash')} disabled={paying} className={ADMIN_PRIMARY_BUTTON}>
                    {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />} {t.cash}
                  </button>
                  <button type="button" onClick={() => handlePay('card')} disabled={paying} className={ADMIN_PRIMARY_BUTTON}>
                    {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} {t.card}
                  </button>
                </div>
              )}
            </section>
          )}

          <section className="rounded-2xl bg-[#F7F5F2] p-5">
            <p className="text-3xl font-semibold tracking-tight text-[#1A1714]">
              {isServicePass
                ? ((giftCard.remaining_visits || 0) === 1 ? t.visitLeft : fillText(t.visitsLeft, { count: giftCard.remaining_visits || 0 }))
                : formatAmount(giftCard.current_balance_cents / 100)}
            </p>
            <p className="mt-1 text-sm text-stone-500">
              {isServicePass
                ? fillText(t.passOriginally, { name: giftCard.service_pass_name || t.servicePass, count: giftCard.original_visits || 0 })
                : fillText(t.of, { amount: formatAmount(giftCard.original_value_cents / 100) })}
            </p>
            <div className="mt-3 h-1.5 w-full rounded-full bg-stone-900/[0.08]">
              <div className="h-1.5 rounded-full bg-[#1A1714]" style={{ width: `${Math.max(0, Math.min(100, balancePercentage))}%` }} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-stone-500">{t.purchased}</dt><dd className="font-medium text-stone-800">{formatDate(giftCard.purchased_at)}</dd></div>
              {giftCard.expires_at && (
                <div><dt className="text-stone-500">{t.validUntil}</dt><dd className={`font-medium ${isExpired ? 'text-red-600' : 'text-stone-800'}`}>{formatDate(giftCard.expires_at)}{isExpired && t.expiredSuffix}</dd></div>
              )}
            </dl>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">{t.contactInfo}</h3>
              {!isEditingEmails ? (
                <button type="button" onClick={() => setIsEditingEmails(true)} className={ADMIN_TERTIARY_BUTTON}><Edit2 className="h-4 w-4" /> {t.edit}</button>
              ) : (
                <button type="button" onClick={handleSaveEmails} disabled={savingEmails} className={ADMIN_TERTIARY_BUTTON}><Save className="h-4 w-4" /> {savingEmails ? t.saving : t.save}</button>
              )}
            </div>
            {isEditingEmails ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label><span className="mb-1 block text-sm text-stone-600">{t.buyerName}</span>
                    <input type="text" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className={ADMIN_INPUT} placeholder={t.buyerNamePlaceholder} /></label>
                  <label><span className="mb-1 block text-sm text-stone-600">{t.buyerEmail}</span>
                    <input type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} className={ADMIN_INPUT} /></label>
                </div>
                <label className="block"><span className="mb-1 block text-sm text-stone-600">{t.recipientEmail}</span>
                  <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} className={ADMIN_INPUT} />
                  <span className="mt-1 block text-xs text-stone-500">{t.recipientHint}</span></label>
                <button type="button" onClick={() => setIsEditingEmails(false)} className={ADMIN_TERTIARY_BUTTON}>{t.cancel}</button>
              </div>
            ) : (
              <ul className="divide-y divide-stone-200/70 rounded-2xl ring-1 ring-stone-200/80">
                {([['buyer', t.buyer, buyerName, buyerEmail], ['recipient', t.recipient, null, recipientEmail]] as const).map(([target, label, name, email]) => (
                  <li key={target} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-xs text-stone-500">{label}</p>
                      {name && <p className="truncate text-sm font-medium text-stone-800">{name}</p>}
                      <p className="truncate text-sm text-stone-700">{email || <span className="text-stone-400">{t.noEmail}</span>}</p>
                    </div>
                    {email && (
                      <button type="button" onClick={() => handleSendEmail(target)} disabled={sendingEmail !== null} className={ADMIN_SECONDARY_BUTTON}>
                        <Mail className="h-4 w-4" /> {sendingEmail === target ? t.sending : t.send}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div>
            <button type="button" onClick={handleDownload} className={ADMIN_SECONDARY_BUTTON}><Download className="h-4 w-4" /> {t.downloadPdf}</button>
          </div>

          {giftCard.status === 'active' && !isExpired && !isServicePass && (
            <section>
              <h3 className={sectionTitle}>{t.redeemHeading}</h3>
              <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end">
                <label><span className="mb-1 block text-sm text-stone-600">{fillText(t.amount, { symbol: currencySymbol })}</span>
                  <input type="number" value={redeemAmount} onChange={(e) => setRedeemAmount(e.target.value)} className={ADMIN_INPUT} placeholder="0,00" step="0.01" max={giftCard.current_balance_cents / 100} /></label>
                <label><span className="mb-1 block text-sm text-stone-600">{t.descriptionOptional}</span>
                  <input type="text" value={redeemDescription} onChange={(e) => setRedeemDescription(e.target.value)} className={ADMIN_INPUT} placeholder={t.descriptionPlaceholder} /></label>
                <button type="button" onClick={handleRedeem} disabled={redeeming || !redeemAmount} className={ADMIN_PRIMARY_BUTTON}>{redeeming ? t.processing : t.redeemAmount}</button>
              </div>
            </section>
          )}

          {giftCard.status === 'active' && !isExpired && isServicePass && (
            <p className="rounded-2xl bg-[#F7F5F2] p-4 text-sm text-stone-600"><span className="font-medium text-stone-800">{t.visitRedemption}.</span> {t.visitRedemptionHint}</p>
          )}

          <section>
            <h3 className={sectionTitle}>{t.history}</h3>
            {loading ? (
              <p className="text-sm text-stone-500">{t.loading}</p>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-stone-500">{t.noTransactions}</p>
            ) : (
              <ul className="divide-y divide-stone-200/70 rounded-2xl ring-1 ring-stone-200/80">
                {transactions.map((txn) => (
                  <li key={txn.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-stone-800">{txn.description}</p>
                      <p className="text-xs text-stone-500">{new Date(txn.created_at).toLocaleString(locale)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`font-semibold tabular-nums ${txn.transaction_type === 'redemption' ? 'text-stone-800' : 'text-emerald-700'}`}>
                        {isServicePass && (txn.visit_count || 0) > 0
                          ? `${txn.transaction_type === 'redemption' ? '−' : '+'}${txn.visit_count === 1 ? t.visitOne : fillText(t.visitMany, { count: txn.visit_count ?? 0 })}`
                          : <>{txn.transaction_type === 'redemption' ? '−' : '+'}{formatAmount(Math.abs(txn.amount_cents / 100))}</>}
                      </p>
                      <p className="text-xs text-stone-500">{TRANSACTION_KEYS[txn.transaction_type] ? t[TRANSACTION_KEYS[txn.transaction_type]] : txn.transaction_type}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="border-t border-stone-200/70 pt-4">
            <button type="button" onClick={handleDelete} disabled={deleting} className={`${ADMIN_TERTIARY_BUTTON} text-red-700 hover:bg-red-50 hover:text-red-800`}>
              <Trash2 className="h-4 w-4" /> {deleting ? t.deleting : t.deleteCard}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
